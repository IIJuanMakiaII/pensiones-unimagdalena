/**
 * Estado sin inventario y mensaje de confianza único (tarea #57).
 *
 * Se prueba en tres frentes, porque cada uno protege algo distinto:
 *
 *   1. **La decisión de mostrar la lista de espera.** Que con el catálogo vacío no
 *      se dibuje una parrilla sin nada dentro es el arreglo entero; dentro del JSX
 *      no habría forma de comprobarlo, y por eso vive en `lib/lista-espera.ts`.
 *   2. **El mensaje que viaja en la URL del contacto**, que es lo único que la
 *      persona envía: si dijera algo que la plataforma no puede cumplir, o llevara
 *      un teléfono dentro, el fallo no se vería en pantalla.
 *   3. **La estructura de la portada**: que la promesa de confianza se enuncie una
 *      sola vez y que el botón del hero lleve a los pasos.
 *   4. **La puerta del propietario**: que la cabecera no ofrezca dos rótulos para el
 *      mismo destino y que el rótulo corto de móvil no rompa el nombre accesible.
 *   5. **La fecha del sello**: que se dibuje cuando exista el dato y que no se
 *      invente ninguna mientras no exista.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA, DICHO SIN ADORNOS
 * --------------------------------------------------
 * Que el bloque se vea bien. Aquí no hay navegador: `components/ListaDeEspera.tsx`
 * no se dibuja en ningún entorno local, porque en desarrollo la demostración está
 * siempre activa y sin ella el estado no aparece —justo al revés que en
 * producción—. Lo que se comprueba es la decisión, el texto y la estructura; el
 * píxel lo tiene que mirar quien pueda abrir la aplicación.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MENSAJE_LISTA_ESPERA, mostrarListaDeEspera } from "@/lib/lista-espera";
import { formatearFechaVerificacion } from "@/lib/sello";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Quita los comentarios antes de afirmar nada sobre un archivo.
 *
 * No es cosmética: dos comprobaciones de aquí son del tipo «esto **no** aparece», y
 * los propios archivos explican en sus comentarios exactamente lo que no hacen.
 * Sin quitarlos, la afirmación mediría la prosa en vez del código.
 *
 * Respeta las cadenas ('…', "…", `…`) para no confundir una barra dentro de un
 * texto con el comienzo de un comentario. Mismo criterio que
 * `pruebas/sello.prueba.ts`; se repite aquí para no tener que editar el archivo de
 * otra tarea mientras su dueño lo está tocando.
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

describe("mostrarListaDeEspera · cuándo la portada deja de dibujar el catálogo", () => {
  it("sin inventario y sin demostración, se muestra la lista de espera", () => {
    assert.equal(mostrarListaDeEspera(0, false), true);
  });

  it("con una sola pensión publicada, se dibuja el catálogo", () => {
    assert.equal(mostrarListaDeEspera(1, false), false);
  });

  it("con la demostración disponible, el catálogo sigue dibujándose", () => {
    // La demostración ES contenido: seis anuncios de ejemplo. Esconderla para
    // mostrar una lista de espera vaciaría la vista previa de lo único que tiene.
    assert.equal(mostrarListaDeEspera(0, true), false);
    assert.equal(mostrarListaDeEspera(3, true), false);
  });

  it("falla hacia la lista de espera ante un conteo que no se puede demostrar", () => {
    // Es el punto del `!(cantidad > 0)`: con `=== 0`, un conteo con forma
    // inesperada dibujaría la parrilla vacía que esto existe para evitar.
    const noDemostrables = [NaN, -1, undefined, null] as unknown as number[];
    for (const valor of noDemostrables) {
      assert.equal(
        mostrarListaDeEspera(valor, false),
        true,
        `«${String(valor)}» no debería dibujar una parrilla vacía`
      );
    }
  });
});

describe("MENSAJE_LISTA_ESPERA · lo que viaja en la URL del contacto", () => {
  it("pide que le avisen, sin prometer inventario que no existe", () => {
    assert.match(MENSAJE_LISTA_ESPERA, /avisen/i);
    assert.match(MENSAJE_LISTA_ESPERA, /Universidad del Magdalena/);
    assert.match(MENSAJE_LISTA_ESPERA, /disponibles/);
  });

  it("no lleva enlaces ni números dentro", () => {
    assert.doesNotMatch(MENSAJE_LISTA_ESPERA, /https?:/);
    assert.doesNotMatch(MENSAJE_LISTA_ESPERA, /\d{7,}/);
  });
});

describe("la portada · el estado sin inventario", () => {
  const pagina = leer("app/page.tsx");

  it("decide con la función, no con una comparación escrita a mano", () => {
    assert.match(pagina, /mostrarListaDeEspera\(pensiones\.length, DEMO_HABILITADA\)/);
  });

  it("entrega el catálogo y la lista de espera como caminos excluyentes", () => {
    assert.match(pagina, /listaDeEspera \? \(\s*<ListaDeEspera \/>/);
    assert.match(pagina, /<CatalogoInteractivo/);
  });

  it("le dice al hero si hay inventario, para no prometer habitaciones que no hay", () => {
    assert.match(pagina, /<Hero sinInventario=\{listaDeEspera\} \/>/);
  });

  it("el encabezado del listado aparece una sola vez, y lo pone el catálogo", () => {
    // La página lo dibujaba por su cuenta y el catálogo también (tarea #56): dos
    // encabezados idénticos seguidos, que un lector de pantalla anuncia dos veces.
    // Se cuenta el total en los dos archivos en vez de fijar dónde vive, para que la
    // afirmación sea la invariante —hay uno— y no la ubicación de una línea.
    const apariciones = ["app/page.tsx", "components/CatalogoInteractivo.tsx"]
      .map((ruta) => (leer(ruta).match(/Pensiones disponibles/g) ?? []).length)
      .reduce((total, cuantas) => total + cuantas, 0);
    assert.equal(apariciones, 1, "«Pensiones disponibles» debe aparecer exactamente una vez");
  });
});

describe("ListaDeEspera · lo que tiene que sostener el estado vacío", () => {
  const componente = leer("components/ListaDeEspera.tsx");

  it("conserva el destino del salto al contenido y del botón del hero", () => {
    // Con el catálogo fuera, el `<main id="resultados">` lo aporta este bloque. Sin
    // él la portada se queda sin landmark principal y «Saltar al contenido» no
    // lleva a ningún sitio.
    assert.match(componente, /<main[\s\S]{0,120}id="resultados"/);
  });

  it("captura el contacto por la puerta única del proyecto", () => {
    assert.match(componente, /enlaceWhatsAppPlataforma\(/);
    // Un `wa.me` escrito a mano es la forma en que el número de ejemplo quedó vivo
    // en un segundo sitio; la construcción del enlace vive en `lib/formato.ts`.
    assert.doesNotMatch(componente, /wa\.me/);
  });

  it("nombra el estado como lo nombraba el catálogo, para no cambiarlo dos veces", () => {
    assert.match(componente, /Todavía no hay pensiones publicadas/);
  });

  it("deja una vía de propietario, con el nombre de siempre", () => {
    assert.match(componente, /Publicar mi pensión/);
  });
});

describe("el mensaje de confianza · una sola vez en la portada", () => {
  const PORTADA = [
    "components/Hero.tsx",
    "components/Footer.tsx",
    "components/ComoFunciona.tsx",
    "components/ListaDeEspera.tsx",
  ];
  const PROMESA_DE_VISITA = /visitamos|inspeccionamos|estuvo físicamente/i;

  it("solo la sección de cómo verificamos enuncia la visita en sitio", () => {
    const conPromesa = PORTADA.filter((ruta) => PROMESA_DE_VISITA.test(leer(ruta)));
    assert.deepEqual(conPromesa, ["components/ComoFunciona.tsx"]);
  });

  it("el hero lleva «Conoce cómo funciona» a la sección de pasos", () => {
    const hero = leer("components/Hero.tsx");
    assert.match(hero, /href="#como-funciona"/);
    assert.doesNotMatch(hero, /#confianza/);
  });

  it("el hero ya no repite los sellos que ahora viven en la sección", () => {
    const hero = leer("components/Hero.tsx");
    assert.doesNotMatch(hero, /CheckBadge/);
    assert.doesNotMatch(hero, /Verificación presencial con sello/);
  });

  it("el pie no vuelve a listar los sellos: solo enlaza a la sección", () => {
    const pie = leer("components/Footer.tsx");
    assert.doesNotMatch(pie, /Sellos de confianza/);
    assert.match(pie, /\/#como-funciona/);
  });
});

describe("la puerta del propietario · una sola, y con el nombre de siempre", () => {
  const entrada = leer("components/EntradaCuenta.tsx");
  const visitante = entrada.slice(
    entrada.indexOf("function BloqueVisitante"),
    entrada.indexOf("function BloqueSesion")
  );

  it("desaparecen los dos rótulos que llevaban al mismo sitio", () => {
    // «Registra tu pensión» y «Crear cuenta» apuntaban LOS DOS a `/registro`. No eran
    // dos caminos: eran dos nombres para la misma página, y en móvil se gastaba la
    // mitad de la barra en repetir la misma oferta.
    assert.doesNotMatch(entrada, /Registra tu pensión/);
    assert.doesNotMatch(entrada, /Crear cuenta/);
    assert.doesNotMatch(entrada, /href="\/registro"/);
  });

  it("queda una vía para el propietario y una para quien ya tiene cuenta", () => {
    // `/publicar` es la puerta correcta y no `/registro`: sin sesión redirige al
    // acceso conservando el destino (`?destino=/publicar`), y desde ahí quien no
    // tenga cuenta la crea. Una sola entrada resuelve los dos casos.
    assert.equal((visitante.match(/href="\/publicar"/g) ?? []).length, 1);
    assert.equal((visitante.match(/href="\/login"/g) ?? []).length, 1);
    assert.match(entrada, /Publicar mi pensión/);
  });

  it("el rótulo corto de móvil no puede sumarse al nombre accesible", () => {
    // `hidden` es CSS: los dos textos están en el DOM y los dos cuentan para el
    // nombre, que saldría «PublicarPublicar mi pensión». Por eso los visibles van con
    // `aria-hidden` y el nombre lo aporta un único texto para lectores. Esto comprueba
    // la forma del marcado, no el nombre calculado: aquí no hay navegador.
    const enlace = visitante.slice(visitante.indexOf('href="/publicar"'));
    const cuerpo = enlace.slice(0, enlace.indexOf("</Link>"));
    assert.match(cuerpo, /aria-hidden="true"/);
    assert.match(cuerpo, /className="sr-only"/);
  });

  it("en el acceso, la cuenta dice para qué sirve", () => {
    // El consejo de la auditoría era conservar «Crear cuenta» solo si queda claro
    // para qué es. Las cuentas de Nido son de anfitrión: quien va a publicar.
    const acceso = leer("components/FormularioLogin.tsx");
    assert.equal((acceso.match(/href="\/registro"/g) ?? []).length, 1);
    assert.match(acceso, /cuenta de anfitrión/);
    assert.match(acceso, /[Pp]ublicar una pensión/);
  });
});

describe("la fecha del sello · lista para cuando el dato exista", () => {
  it("sin fecha no inventa ninguna", () => {
    // El sello se dibuja sin fecha mientras el dato no llegue, que es el caso de una
    // base sin `oleada-13` aplicada (tarea #61). Lo que se comprueba es que ninguna
    // otra cosa pueda colarse como si lo fuera.
    const noSonFechas = [undefined, null, "", "   ", {}, [], 42, true, "no es una fecha", "2026-13-45"];
    for (const valor of noSonFechas) {
      assert.equal(
        formatearFechaVerificacion(valor),
        null,
        `«${String(valor)}» no debería producir una fecha`
      );
    }
  });

  it("un `Date` del dominio se dibuja: es la forma que entrega la base", () => {
    // `lib/supabase/mapeo.ts` no entrega la cadena de la columna: entrega un `Date`
    // (tarea #61). Si el formateador solo aceptara texto, toda esta batería seguiría
    // en verde y el sello no mostraría la fecha jamás — el fallo invisible que la
    // tarea #61 existe justamente para evitar. Se prueba con el instante de una visita.
    const visita = new Date("2026-10-05T20:30:00.000Z");
    const texto = formatearFechaVerificacion(visita);

    assert.ok(texto, "un `Date` del dominio tiene que producir texto: es lo que llega de la base");
    assert.equal(
      texto,
      formatearFechaVerificacion(visita.toISOString()),
      "el mismo instante tiene que salir igual venga como `Date` o como cadena"
    );
    assert.doesNotMatch(texto, /Invalid/);
  });

  it("una fecha real sale legible, no como la cadena que llega", () => {
    const texto = formatearFechaVerificacion("2026-10-12T15:00:00.000Z");
    assert.ok(texto, "una fecha ISO válida tiene que producir texto");
    assert.match(texto, /2026/);
    assert.match(texto, /12/);
    assert.doesNotMatch(texto, /Invalid/);
  });

  it("formatea en la zona de Santa Marta, no en la del servidor", () => {
    // Una visita de las 20:00 en Santa Marta ya es el día siguiente en UTC. Si se
    // formateara con la zona del servidor, el sello mostraría un día que no es el de
    // nadie, en la única insignia del sitio que afirma algo comprobado.
    // 13 oct 01:00 UTC = 12 oct 20:00 en Bogotá.
    const enBogota = formatearFechaVerificacion("2026-10-13T01:00:00.000Z");
    assert.ok(enBogota, "la fecha tiene que formatearse");
    assert.match(enBogota, /12/);
    assert.doesNotMatch(enBogota, /13/);
  });

  it("la tarjeta le pasa la fecha al sello y el sello solo la dibuja si existe", () => {
    const etiqueta = leer("components/EtiquetaVerificado.tsx");
    assert.match(etiqueta, /formatearFechaVerificacion\(/);
    assert.match(etiqueta, /\{fecha &&/);

    const tarjeta = leer("components/CardPension.tsx");
    // La tarjeta lee el campo del dominio tal cual: el nombre lo comparten la
    // columna, el mapeo y el tipo, y una discrepancia ahí no rompe nada visible,
    // solo deja el sello sin fecha para siempre.
    assert.match(tarjeta, /verificadoEn=\{pension\.verificado_en\}/);
  });

  it("la fecha del sello no es la de publicación del anuncio", () => {
    // El error más fácil y el más grave: `creada_en` es cuándo se creó el anuncio, no
    // cuándo se visitó. Un sello fechado afirma una comprobación, y en Colombia esa
    // afirmación tiene consecuencias de protección al consumidor.
    assert.doesNotMatch(leer("components/EtiquetaVerificado.tsx"), /creada_en/);
    assert.doesNotMatch(leer("components/CardPension.tsx"), /creada_en/);
  });
});
