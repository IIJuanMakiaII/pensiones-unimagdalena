/**
 * El fallo de lectura se lee distinto que el catálogo vacío (tarea #68).
 *
 * EL FALLO QUE ESTA PRUEBA CIERRA
 * -------------------------------
 * Hasta hoy la portada decidía con `pensiones.length`, y un corte de la base y un
 * catálogo legítimamente vacío devuelven lo mismo: cero anuncios. Las dos situaciones
 * se leían con la misma frase, así que un visitante durante una avería se iba creyendo
 * que Nido no tenía habitaciones, cuando lo que pasó es que Nido no pudo preguntar.
 *
 * QUÉ SE COMPRUEBA, Y POR QUÉ ASÍ
 * ------------------------------
 * Aquí no hay navegador: se afirma sobre la **estructura** de dos archivos. Y para eso
 * hace falta quitar los comentarios primero, porque las dos afirmaciones centrales son
 * del tipo «esto **no** aparece» y los propios archivos explican en su prosa justo lo
 * que no hacen —`ErrorCatalogo.tsx` menciona el título del vacío legítimo y la promesa
 * de la lista de espera al explicar por qué no los usa—. Sin quitar los comentarios,
 * esta prueba mediría la explicación en lugar del código.
 *
 * El helper se repite respecto a `pruebas/lista-espera.prueba.ts` a propósito: ese
 * archivo es de la tarea #57 y duplicar seis líneas es más barato que acoplar dos
 * tareas por una función de lectura.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA
 * ------------------------------
 * Que el estado se vea bien, ni que la base real falle de la forma que aquí se supone.
 * La decisión sobre el motivo la prueba `pruebas/motivo-catalogo.prueba.ts` conduciendo
 * la función real (tarea #67); aquí se comprueba qué hace la portada con esa decisión.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Quita comentarios respetando las cadenas, para no medir la prosa del archivo. */
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
      while (
        i < codigoFuente.length &&
        !(codigoFuente[i] === "*" && codigoFuente[i + 1] === "/")
      ) {
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

function leer(ruta: string): string {
  return sinComentarios(readFileSync(join(RAIZ, ruta), "utf8"));
}

/** El texto visible del `<h2>` cuyo `id` se indique, leído del marcado. */
function tituloDelBloque(codigo: string, id: string): string {
  const desde = codigo.indexOf(`id="${id}"`);
  if (desde < 0) return "";

  const encontrado = codigo.slice(desde).match(/>\s*([^<>{}]+?)\s*<\/h2>/);
  return encontrado ? encontrado[1].trim() : "";
}

describe("la portada · la avería no puede leerse como un catálogo vacío", () => {
  const pagina = leer("app/page.tsx");

  it("le pregunta al motivo, no a la longitud de la lista", () => {
    // El único dueño de la decisión es `esFalloDeLectura()`. Si la portada comparara
    // la cadena por su cuenta, habría dos sitios decidiendo lo mismo y uno de los dos
    // se quedaría atrás en el próximo cambio de vocabulario.
    assert.match(pagina, /esFalloDeLectura\(catalogo\)/);
    assert.doesNotMatch(pagina, /motivo\s*===\s*["']error["']/);
  });

  it("resuelve la avería antes que el vacío", () => {
    // El orden es la corrección, no un detalle de estilo: si el estado sin inventario
    // se evaluara primero, un fallo de lectura lo activaría y volveríamos a prometer
    // una alerta durante una avería.
    const posicionAveria = pagina.indexOf("<ErrorCatalogo />");
    const posicionLista = pagina.indexOf("<ListaDeEspera />");

    assert.ok(posicionAveria >= 0, "la rama de avería tiene que existir");
    assert.ok(posicionLista >= 0, "la rama de lista de espera tiene que seguir existiendo");
    assert.ok(
      posicionAveria < posicionLista,
      "la avería tiene que resolverse antes que el vacío legítimo"
    );
  });

  it("la lista de espera queda condicionada a que no haya fallo", () => {
    // Y con ella el hero: `sinInventario` es lo que hace que el botón principal diga
    // «Avísame cuando haya habitaciones». Durante una avería esa frase es una promesa
    // sobre un inventario que nadie ha podido consultar.
    assert.match(pagina, /!falloDeLectura && mostrarListaDeEspera\(/);
  });

  it("sigue entregando el catálogo y la lista de espera como caminos excluyentes", () => {
    // Lo que ya sostenía la tarea #57 y no puede perderse al añadir el tercer estado:
    // con inventario se dibuja el catálogo, y con el vacío legítimo, la lista de espera.
    assert.match(pagina, /<CatalogoInteractivo/);
    assert.match(pagina, /\) : listaDeEspera \? \(\s*<ListaDeEspera \/>/);
  });
});

describe("ErrorCatalogo · lo que este estado tiene que sostener", () => {
  const componente = leer("components/ErrorCatalogo.tsx");
  const espera = leer("components/ListaDeEspera.tsx");

  it("conserva el destino del salto al contenido y del botón del hero", () => {
    // Sin el catálogo, el `<main id="resultados">` lo aporta este bloque. Sin él la
    // portada se queda sin landmark principal y «Saltar al contenido» no lleva a
    // ningún sitio. Es el mismo motivo por el que lo declara `ListaDeEspera`.
    assert.match(componente, /<main[\s\S]{0,120}id="resultados"/);
    assert.match(componente, /tabIndex=\{-1\}/);
  });

  it("no repite el título del vacío legítimo", () => {
    // Es el corazón de la tarea: si el estado de avería reutiliza la frase del vacío,
    // las dos situaciones siguen siendo indistinguibles para el visitante, para una
    // captura de pantalla y para cualquier verificador que busque la cadena.
    assert.doesNotMatch(componente, /Todavía no hay pensiones publicadas/);

    const tituloAveria = tituloDelBloque(componente, "error-catalogo-titulo");
    const tituloVacio = tituloDelBloque(espera, "lista-espera-titulo");

    assert.ok(tituloAveria.length > 0, "el bloque de avería tiene que tener título propio");
    assert.ok(tituloVacio.length > 0, "el bloque del vacío conserva el suyo");
    assert.notEqual(
      tituloAveria,
      tituloVacio,
      "los dos estados no pueden leerse con el mismo título"
    );
  });

  it("no promete una alerta de inventario", () => {
    // «Déjanos tu WhatsApp y te avisamos» es la promesa del estado sin inventario.
    // Hacerla durante una avería manda al estudiante a esperar algo que no corresponde
    // al problema: lo que falló es la consulta, no la oferta.
    assert.doesNotMatch(componente, /Avísame/);
    assert.doesNotMatch(componente, /te avisamos/i);
    assert.doesNotMatch(componente, /[Tt]e escribimos en cuanto/);
  });

  it("dice explícitamente que no significa que no haya habitaciones", () => {
    // La frase que separa las dos situaciones para quien lee: sin ella, un visitante
    // puede interpretar el fallo como «no hay nada publicado».
    assert.match(componente, /no quiere decir\s+que no haya habitaciones publicadas/);
  });

  it("el contacto pasa por la puerta única del canal", () => {
    assert.match(componente, /enlaceWhatsAppPlataforma\(/);
    assert.doesNotMatch(componente, /wa\.me/);
  });

  it("el reintento no depende de JavaScript", () => {
    // La portada se revalida cada 60 s: un reintento inmediato puede servir la página
    // ya guardada. Da igual mientras sea un enlace real, que funciona sin hidratar.
    assert.match(componente, /href="\/"/);
  });
});
