/**
 * El buscador del panel maestro y el código visible en pantalla (tarea #88).
 *
 * Dos mitades, y la segunda existe por la primera.
 *
 * LA PRIMERA: LA REGLA DE COINCIDENCIA
 * ------------------------------------
 * El buscador es la pieza que más fácil se rompe **sin que nadie lo note**. Un
 * acento que se deja de quitar, una mayúscula, un guion: el resultado cambia y el
 * panel no avisa cuando encuentra de menos —enseña una lista corta y quien busca
 * concluye que el anuncio no existe—. Por eso la regla vive en un módulo `.ts`
 * puro (`lib/busqueda-panel.ts`) y aquí se ejercita con casos concretos, incluidos
 * los que el formato `NID-0001` hace inevitables: `NID-1`, `nid 1` y `0001` tienen
 * que encontrar el mismo anuncio, porque el identificador existe para poder
 * dictarse por teléfono y quien llama no dice los ceros.
 *
 * LA SEGUNDA: EL CABLEADO
 * -----------------------
 * Una regla correcta que no está conectada a nada es peor que no tenerla: pasa
 * desapercibida. Aquí se afirma sobre el código de las tres pantallas que
 * intervienen (`app/maestro/page.tsx`, `components/PanelMaestro.tsx`,
 * `components/FormularioEditarPension.tsx`) que el filtro se aplica a la lista, que
 * el campo es un formulario GET —sin JavaScript, sin estado de cliente—, que el
 * estado «sin resultados» tiene su propio mensaje y **no** reutiliza el de «no hay
 * ninguna pensión publicada», y que el código se pinta **tal como llegó**, sin
 * rellenarlo ni recalcularlo. Esto último no es un detalle de estilo: un código
 * fabricado en la interfaz —a partir del `id`, del `slug` o de la posición en la
 * lista— puede repetirse o cambiar de un listado a otro, que es exactamente lo
 * contrario de lo que un identificador sirve para hacer.
 *
 * Y una tercera, corta: el ID **no se asoma a ninguna superficie pública**. Se
 * comprueba leyendo los archivos que dibujan el catálogo y la ficha, no confiando
 * en que nadie lo añada más adelante sin querer.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MAXIMO_DE_CONSULTA,
  filtrarPensiones,
  normalizarDimension,
  prepararConsulta,
  type PensionBuscable,
} from "@/lib/busqueda-panel";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Quita los comentarios antes de afirmar nada sobre un archivo (mismo ayudante que
 * en `panel-maestro.prueba.ts`).
 *
 * No es cosmética: varias de estas comprobaciones son del tipo «esto **no**
 * aparece», y los propios archivos explican en sus comentarios lo que no hacen. Sin
 * quitarlos, el comentario que documenta una ausencia haría fallar la prueba que la
 * vigila. Respeta las cadenas para no confundir una barra dentro de un texto con el
 * comienzo de un comentario.
 */
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

/** El código de un archivo, sin comentarios. Todo lo que se afirma aquí va sobre esto. */
function fuente(relativa: string): string {
  return sinComentarios(readFileSync(join(RAIZ, ...relativa.split("/")), "utf8"));
}

/* -------------------------------------------------------------------------- */
/* Anuncios de laboratorio                                                     */
/* -------------------------------------------------------------------------- */

/** Un anuncio con lo único que el buscador mira. */
function anuncio(datos: Partial<PensionBuscable> & { slug: string }): PensionBuscable {
  return {
    codigo_visible: null,
    titulo: "Sin título",
    barrio: "Santa Marta",
    ...datos,
  };
}

const COSTA_VERDE = anuncio({
  codigo_visible: "NID-0001",
  titulo: "Pensión Costa Verde",
  slug: "pension-costa-verde",
  barrio: "Mamatoco",
});

/**
 * El `slug` y el barrio **no** contienen el título a propósito: así el único sitio
 * donde aparece «Cabaña» es el título, y la prueba de acentos no puede pasar por
 * casualidad porque el `slug` ya la trajera sin tilde.
 */
const CABANA = anuncio({
  codigo_visible: "NID-0042",
  titulo: "Cabaña del Caribe",
  slug: "caribe-42",
  barrio: "Bello Horizonte",
});

const VILLA = anuncio({
  codigo_visible: "NID-0103",
  titulo: "Villa del Caribe",
  slug: "villa-103",
  barrio: "El Pando",
});

/** Un anuncio de antes de la migración: la columna todavía no le repartió código. */
const SIN_CODIGO = anuncio({
  titulo: "Residencia Makía",
  slug: "residencia-makia",
  barrio: "Bavaria",
});

const CATALOGO = [COSTA_VERDE, CABANA, VILLA];

/* -------------------------------------------------------------------------- */
/* La regla                                                                    */
/* -------------------------------------------------------------------------- */

describe("el buscador encuentra un anuncio por su código visible", () => {
  it("las formas en que se teclea un mismo código encuentran el mismo anuncio", () => {
    // Las tres primeras son la misma consulta escrita como la escribiría cualquiera;
    // las dos últimas son la razón de ser de la segunda regla: el código se dicta por
    // teléfono y quien lo dicta dice «nido uno», no «nido cero cero cero uno».
    for (const forma of ["NID-0001", "nid-0001", "nid 0001", "nid0001", "NID-1", "nid 1", "0001"]) {
      assert.deepEqual(
        filtrarPensiones(CATALOGO, forma),
        [COSTA_VERDE],
        `«${forma}» tiene que encontrar NID-0001`
      );
    }
  });

  it("la forma dictada por teléfono no arrastra medio catálogo", () => {
    // Esta es la prueba que justifica la tercera regla del módulo: `nid 1` se parte
    // en dos tokens y, si solo mandara la coincidencia por subcadena, todo código
    // con un `1` dentro coincidiría —en un catálogo de cien, casi la mitad—. Con el
    // código completo identificando, devuelve el anuncio y nada más.
    const muchos = [
      COSTA_VERDE, // NID-0001
      anuncio({ codigo_visible: "NID-0010", slug: "anuncio-10", titulo: "Residencia Diez" }),
      anuncio({ codigo_visible: "NID-0103", slug: "anuncio-103", titulo: "Residencia Ciento Tres" }),
      anuncio({ codigo_visible: "NID-0141", slug: "anuncio-141", titulo: "Residencia Ciento Cuarenta y Uno" }),
    ];

    assert.deepEqual(filtrarPensiones(muchos, "nid 1"), [COSTA_VERDE]);
    assert.deepEqual(filtrarPensiones(muchos, "NID-1"), [COSTA_VERDE]);
    assert.deepEqual(filtrarPensiones(muchos, "NID-141"), [muchos[3]]);
  });

  it("no distingue mayúsculas de minúsculas", () => {
    const enMayusculas = filtrarPensiones(CATALOGO, "NID-0042");
    const enMinusculas = filtrarPensiones(CATALOGO, "nid-0042");

    assert.deepEqual(enMayusculas, [CABANA]);
    assert.deepEqual(enMinusculas, enMayusculas);
  });

  it("una coincidencia parcial del código también encuentra", () => {
    // `nid000` es el prefijo de un solo anuncio de este catálogo.
    assert.deepEqual(filtrarPensiones(CATALOGO, "nid000"), [COSTA_VERDE]);
  });

  it("un parcial corto no promete unicidad, y eso es correcto", () => {
    // `nid00` es prefijo de NID-0001 y de NID-0042. La prueba fija el comportamiento
    // real —devuelve los dos, en el orden de la lista— en lugar de fingir que un
    // parcial de tres dígitos identifica a alguien: quien busca un anuncio concreto
    // teclea el código completo.
    assert.deepEqual(filtrarPensiones(CATALOGO, "nid00"), [COSTA_VERDE, CABANA]);
  });

  it("el formato admite más de cuatro dígitos cuando el catálogo crezca", () => {
    // El techo de cuatro dígitos se agota en 9999 anuncios; a partir de ahí la base
    // produce NID-10000 y el buscador tiene que seguir entendiéndolo igual.
    const cincoDigitos = anuncio({ codigo_visible: "NID-10000", slug: "anuncio-10000" });

    assert.deepEqual(filtrarPensiones([cincoDigitos], "NID-10000"), [cincoDigitos]);
    assert.deepEqual(filtrarPensiones([cincoDigitos], "nid 10000"), [cincoDigitos]);
    assert.deepEqual(filtrarPensiones([cincoDigitos], "NID-9999"), []);
  });

  it("un código que no existe no devuelve nada, y no lleva a ningún sitio", () => {
    assert.deepEqual(filtrarPensiones(CATALOGO, "NID-9999"), []);
  });

  it("un anuncio sin código sigue siendo encontrable por su nombre", () => {
    // El estado real mientras la migración no esté aplicada, y también el de
    // cualquier anuncio futuro al que la base todavía no le haya repartido uno.
    assert.deepEqual(filtrarPensiones([SIN_CODIGO], "residencia makia"), [SIN_CODIGO]);
    assert.deepEqual(filtrarPensiones([SIN_CODIGO], "NID-0001"), []);
  });
});

describe("el buscador perdona los acentos y el orden de las palabras", () => {
  it("quita los diacríticos antes de comparar", () => {
    assert.equal(normalizarDimension("Cabaña"), "cabana");
    assert.equal(normalizarDimension("San José"), "sanjose");
    assert.equal(normalizarDimension("NID-0001"), "nid0001");
    assert.equal(normalizarDimension("  El Pando  "), "elpando");
  });

  it("`cabana` encuentra «Cabaña» aunque el slug no la delate", () => {
    // El título es «Cabaña del Caribe» y el slug es `caribe-42`: si la tilde no se
    // quitara, la consulta sin tilde no encontraría nada.
    assert.deepEqual(filtrarPensiones(CATALOGO, "cabana"), [CABANA]);
  });

  it("los tokens se pueden teclear en cualquier orden y con palabras de por medio", () => {
    // «Villa del Caribe» tiene «villa caribe» partido por «del».
    assert.deepEqual(filtrarPensiones(CATALOGO, "villa caribe"), [VILLA]);
    assert.deepEqual(filtrarPensiones(CATALOGO, "caribe villa"), [VILLA]);
  });

  it("un token que no está en ningún campo descarta el anuncio", () => {
    // «costa» está en uno y «pando» en otro, pero ningún anuncio tiene los dos.
    assert.deepEqual(filtrarPensiones(CATALOGO, "costa pando"), []);
  });

  it("busca también por el barrio y por la dirección pública", () => {
    assert.deepEqual(filtrarPensiones(CATALOGO, "mamatoco"), [COSTA_VERDE]);
    assert.deepEqual(filtrarPensiones(CATALOGO, "pension-costa-verde"), [COSTA_VERDE]);
  });
});

describe("el buscador no filtra más de lo que dice ni cambia el orden", () => {
  it("una consulta vacía o solo con espacios no filtra: devuelve la misma lista", () => {
    // `assert.equal` sobre el mismo objeto: no basta con que el contenido coincida,
    // tiene que ser **la misma lista** que llegó, sin recorrerla siquiera.
    assert.equal(filtrarPensiones(CATALOGO, ""), CATALOGO);
    assert.equal(filtrarPensiones(CATALOGO, "   "), CATALOGO);
    assert.equal(filtrarPensiones(CATALOGO, "  \t\n "), CATALOGO);
  });

  it("filtra sin reordenar: el orden de la lista es el que decide el panel", () => {
    const alReves = [...CATALOGO].reverse();

    assert.deepEqual(filtrarPensiones(alReves, "caribe"), [VILLA, CABANA]);
  });

  it("el precio no está indexado: un número alto no trae medio catálogo", () => {
    // Los anuncios traen precio y habitaciones; el buscador no los mira. Se comprueba
    // sobre objetos que **sí** los tienen, que es el único caso en el que la
    // afirmación significa algo.
    const conPrecio = {
      ...COSTA_VERDE,
      precioMensual: 600000,
      habitaciones: [{ precio_mensual_cop: 600000 }],
    };

    assert.deepEqual(filtrarPensiones([conPrecio], "600000"), []);
    assert.deepEqual(filtrarPensiones([conPrecio], "600"), []);
  });

  it("la consulta se recorta y se corta a 60 caracteres", () => {
    assert.equal(prepararConsulta("  nid0001  "), "nid0001");
    assert.equal(prepararConsulta("a".repeat(200)).length, MAXIMO_DE_CONSULTA);
    assert.equal(MAXIMO_DE_CONSULTA, 60);
    assert.deepEqual(filtrarPensiones(CATALOGO, `${"x".repeat(80)} nid0001`), []);
  });
});

/* -------------------------------------------------------------------------- */
/* El cableado                                                                 */
/* -------------------------------------------------------------------------- */

describe("el panel maestro usa el filtro, sin JavaScript y sin consultar la base", () => {
  const panel = fuente("app/maestro/page.tsx");

  it("lee la consulta de la dirección y filtra la lista que ya trajo", () => {
    assert.ok(panel.includes("buscar?: string"), "la consulta viaja en `searchParams`");
    assert.ok(
      panel.includes("filtrarPensiones(pensiones"),
      "el filtro se aplica a la lista que `obtenerTodasLasPensiones()` ya trajo"
    );
    assert.ok(panel.includes("prepararConsulta"), "el recorte y el tope salen del módulo, no de la página");
  });

  it("no añade ni una consulta a la base: el buscador filtra en memoria", () => {
    assert.equal(
      panel.includes('.from("pensiones")'),
      false,
      "el panel no habla con la base para buscar; la lista ya está leída"
    );
  });

  it("el campo es un formulario GET: sobrevive a recargar y se puede compartir", () => {
    assert.ok(panel.includes('method="get"'), "sin JavaScript: la búsqueda es una navegación");
    assert.ok(panel.includes('action="/maestro"'));
    assert.ok(panel.includes('name="buscar"'), "el nombre del parámetro es el de la dirección");
    assert.ok(panel.includes('htmlFor="buscar"'), "la etiqueta está atada al campo");
    assert.ok(panel.includes(">Buscar<") || />\s*Buscar\s*</.test(panel));
  });

  it("el campo está preparado para escribir o dictar un código en el móvil", () => {
    assert.ok(panel.includes('type="search"'));
    assert.ok(panel.includes('enterKeyHint="search"'));
    assert.ok(panel.includes('autoComplete="off"'));
    assert.ok(panel.includes('autoCapitalize="characters"'));
    assert.ok(panel.includes("spellCheck={false}"));
    assert.ok(panel.includes("maxLength={MAXIMO_DE_CONSULTA}"), "el tope del módulo, no un número suelto");
    assert.ok(panel.includes('placeholder="NID-0001, nombre o barrio"'));
  });

  it("el alto del campo y del botón es de 48 px", () => {
    const altos = panel.match(/h-12/g) ?? [];

    assert.ok(altos.length >= 2, "el campo y el botón alcanzan el mínimo táctil de 44 px");
  });

  it("el estado «sin resultados» tiene su propio mensaje y no dice que el catálogo esté vacío", () => {
    assert.ok(panel.includes('role="status"'));
    assert.match(panel, /Ninguna pensión coincide con «\{consulta\}»/);
    assert.ok(
      panel.includes("No hay ninguna pensión publicada todavía."),
      "el mensaje del catálogo vacío sigue existiendo para su caso, que es otro"
    );
    assert.match(
      panel,
      /Ver los \{pensiones\.length\} anuncios/,
      "el enlace de vuelta dice cuántos anuncios hay de verdad"
    );
  });

  it("la consulta se pinta como texto, nunca como marcado", () => {
    assert.equal(
      panel.includes("dangerouslySetInnerHTML"),
      false,
      "la consulta la escribe quien la teclea: interpolarla como HTML sería inyectar"
    );
  });

  it("solo hay enlace de limpieza cuando hay algo que limpiar", () => {
    assert.ok(panel.includes("Quitar la búsqueda"));
    assert.ok(panel.includes("hayConsulta &&"));
  });

  it("la sección se rotula con su encabezado cuando hay consulta", () => {
    assert.ok(panel.includes("aria-labelledby"), "el recuento se lee al entrar en la región");
    assert.ok(panel.includes('id="titulo-publicaciones"'));
  });

  it("el recuento general de arriba sigue contando el total, no el filtro", () => {
    assert.ok(
      panel.includes('{pensiones.length} anuncio{pensiones.length === 1 ? "" : "s"} en total ·'),
      "el total y las publicadas/retiradas no cambian porque alguien busque"
    );
  });
});

describe("el código se pinta tal como llegó", () => {
  it("la tarjeta del panel lo muestra entre el título y la línea de barrio y slug", () => {
    const tarjeta = fuente("components/PanelMaestro.tsx");

    const titulo = tarjeta.indexOf("</h3>");
    const codigo = tarjeta.indexOf("{pension.codigo_visible}");
    const barrio = tarjeta.indexOf("{pension.barrio");

    assert.ok(codigo !== -1, "la tarjeta del panel muestra el código");
    assert.ok(titulo !== -1 && barrio !== -1);
    assert.ok(titulo < codigo, "el encabezado accesible de la tarjeta sigue siendo el título");
    assert.ok(codigo < barrio, "y el código va antes de la línea de barrio y dirección");
    assert.ok(tarjeta.includes("font-display text-sm font-bold tabular-nums text-neutro-800"));
  });

  it("la interfaz no lo formatea, no lo rellena y no lo recalcula", () => {
    for (const archivo of [
      "components/PanelMaestro.tsx",
      "components/FormularioEditarPension.tsx",
    ]) {
      const codigoFuente = fuente(archivo);

      // Las dos formas de fabricar un código en la interfaz son inventarse el prefijo
      // y rellenar los dígitos. Ninguna de las dos puede aparecer.
      for (const prohibido of ["padStart", '"NID-"', "'NID-'", "codigo_visible ||", "?? `NID"]) {
        assert.equal(
          codigoFuente.includes(prohibido),
          false,
          `${archivo} no puede contener «${prohibido}»: el formato lo fija la base y una sola fuente de formato`
        );
      }
    }
  });

  it("la pantalla de edición lo muestra como texto y no como campo", () => {
    const editor = fuente("components/FormularioEditarPension.tsx");

    const encabezado = editor.indexOf("</h1>");
    const etiqueta = editor.indexOf("ID de esta pensión");
    const subtitulo = editor.indexOf("Los cambios se ven");

    assert.ok(etiqueta !== -1, "la edición dice cuál es el ID de esta pensión");
    assert.ok(encabezado < etiqueta, "va después del título de la pantalla");
    assert.ok(etiqueta < subtitulo, "y antes del subtítulo que ya existía");
    assert.ok(editor.includes("{pension.codigo_visible}"));
    assert.equal(
      /<input[^>]*codigo_visible/.test(editor),
      false,
      "un campo ahí parecería editable y el guardado podría intentar escribirlo"
    );
    assert.equal(editor.includes('name="codigo_visible"'), false);
  });
});

describe("el ID no se asoma a ninguna superficie pública", () => {
  /**
   * El catálogo, la ficha, la portada y los archivos que Google lee. Al estudiante no
   * le sirve —su asa es la dirección— y un consecutivo publicado cuenta el tamaño del
   * inventario. Si alguien lo añade aquí, esta prueba lo dice antes de que se publique.
   */
  const PUBLICOS = [
    "app/page.tsx",
    "app/pensiones/[id]/page.tsx",
    "app/sitemap.ts",
    "app/robots.ts",
    "app/manifest.ts",
    "components/CardPension.tsx",
    "components/DetallePension.tsx",
  ];

  it("`NID-` y el campo del código no aparecen en lo que ve cualquiera", () => {
    for (const archivo of PUBLICOS) {
      const codigoFuente = fuente(archivo);

      assert.equal(codigoFuente.includes("NID-"), false, `${archivo} no puede contener «NID-»`);
      assert.equal(
        codigoFuente.includes("codigo_visible"),
        false,
        `${archivo} no puede leer el código: es un dato de administración`
      );
    }
  });
});
