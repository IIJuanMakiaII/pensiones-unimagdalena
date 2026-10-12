/**
 * «Quiénes somos»: la página, su identidad y sus enlaces.
 *
 * Se prueba en cuatro frentes, y cada uno protege algo que se rompe en silencio:
 *
 *   1. **La identidad tiene una sola fuente.** El nombre, el LinkedIn y el correo
 *      se publican además en los datos estructurados `Person`. Si la página
 *      escribiera el enlace a mano y el `Person` lo tomara del módulo, podrían
 *      decir cosas distintas y nadie lo notaría: Google lee los dos.
 *   2. **La foto es propia.** El retrato tiene que servirse desde el dominio. Una
 *      imagen de un tercero convierte la sección que existe para dar confianza en
 *      una que depende de que otro servicio siga en pie.
 *   3. **La compuerta de los datos estructurados.** Que el `Person` declare el
 *      LinkedIn como `sameAs` es lo que permite a un buscador unir la persona con
 *      su perfil; sin eso, el `Person` es un nombre suelto.
 *   4. **Se llega desde alguna parte.** Una página que no se enlaza ni se anuncia
 *      en el mapa del sitio es, para quien navega y para el robot, una página que
 *      no existe.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA, DICHO SIN ADORNOS
 * --------------------------------------------------
 * Que la página se vea bien. Eso no se defiende leyendo el código: se comprueba
 * abriéndola, y lo mide la verificación de estados contra el despliegue.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FUNDADOR } from "@/lib/persona";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Quita los comentarios antes de afirmar nada sobre un archivo.
 *
 * Hace falta por el mismo motivo que en `pruebas/sello.prueba.ts`: varias de
 * estas comprobaciones son del tipo «esto **no** aparece», y los archivos
 * explican en sus comentarios justo lo que no hacen —esta página cuenta que
 * *no* lee el catálogo, y `lib/persona.ts` cuenta que *no* deja el apellido
 * fuera—. Sin quitarlos, la afirmación mediría la prosa en vez del código.
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

const PAGINA = "app/quienes-somos/page.tsx";

describe("la identidad · una sola fuente para tres datos que se publican dos veces", () => {
  it("el módulo declara el perfil exacto que se pidió publicar", () => {
    assert.equal(FUNDADOR.linkedin, "https://www.linkedin.com/in/juan-s-otero-c/");
    assert.equal(FUNDADOR.correo, "oterojuan15@gmail.com");
  });

  it("el correo es una dirección con forma de dirección, no un texto suelto", () => {
    assert.match(FUNDADOR.correo, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it("la página toma los dos enlaces del módulo y no los vuelve a escribir", () => {
    const pagina = leer(PAGINA);
    assert.match(pagina, /FUNDADOR\.linkedin/);
    assert.match(pagina, /FUNDADOR\.correo/);
    // La comprobación que de verdad importa: si alguien reescribe el enlace en el
    // marcado, quedan dos fuentes y la prueba lo caza.
    assert.doesNotMatch(pagina, /linkedin\.com/);
    assert.doesNotMatch(pagina, /oterojuan15/);
  });

  it("el nombre visible también sale del módulo", () => {
    const pagina = leer(PAGINA);
    assert.match(pagina, /FUNDADOR\.nombreDePila/);
    assert.match(pagina, /FUNDADOR\.nombre/);
  });
});

describe("la foto · del dominio, nunca de un tercero", () => {
  it("el archivo existe en el repositorio", () => {
    assert.ok(
      existsSync(join(RAIZ, "public", FUNDADOR.foto.replace(/^\//, ""))),
      `falta public${FUNDADOR.foto}: la página mostraría un hueco`
    );
  });

  it("se sirve como ruta propia y no como URL externa", () => {
    assert.match(FUNDADOR.foto, /^\/marca\/[\w.-]+\.(jpg|jpeg|png|webp)$/);
    assert.doesNotMatch(FUNDADOR.foto, /^https?:/);
  });

  it("el marco reserva el alto antes de que la imagen cargue", () => {
    // Con `fill` sin contenedor de relación fija, la sección salta al aparecer la
    // foto. El `aspect-[4/5]` es lo que lo evita, y es además la proporción que
    // el borrador pedía para el retrato.
    const pagina = leer(PAGINA);
    assert.match(pagina, /aspect-\[4\/5\]/);
    assert.match(pagina, /sizes=/);
  });
});

describe("los datos estructurados · qué declara la página ante un buscador", () => {
  const pagina = leer(PAGINA);

  it("se declara como página «acerca de» con una persona dentro", () => {
    assert.match(pagina, /"@type": "AboutPage"/);
    assert.match(pagina, /"@type": "Person"/);
  });

  it("une a la persona con su perfil profesional", () => {
    // `sameAs` es el campo que permite al buscador entender que el «Juan» de esta
    // página y el perfil de LinkedIn son la misma persona.
    assert.match(pagina, /sameAs: \[FUNDADOR\.linkedin\]/);
  });

  it("declara la canónica de la ruta propia", () => {
    assert.match(pagina, /canonical: `\$\{SITIO_URL\}\/quienes-somos`/);
  });

  it("declara las migas de pan, como el resto del contenido", () => {
    assert.match(pagina, /jsonLdMigas\(MIGAS\)/);
    assert.match(pagina, /ruta: "\/quienes-somos"/);
  });
});

describe("la página · lo que no hace", () => {
  const pagina = leer(PAGINA);

  it("no lee el catálogo", () => {
    // Es lo que la mantiene fuera de `RUTAS_DEL_CATALOGO`: no es una vista del
    // inventario, es contenido permanente, y por eso no participa en la
    // invalidación de caché ni puede quedarse desactualizada.
    assert.doesNotMatch(pagina, /obtenerPensiones|obtenerCatalogo|obtenerTodasLasPensiones/);
  });

  it("no es un componente de cliente", () => {
    assert.doesNotMatch(pagina, /"use client"/);
  });

  it("no inventa un canal de contacto que pueda estar caído", () => {
    // El botón de WhatsApp tiene que preguntar antes si el canal sirve: si no,
    // dibujaría un enlace que lleva al vacío, que es el fallo que el resto del
    // sitio ya evita.
    assert.match(pagina, /WHATSAPP_DISPONIBLE/);
    assert.match(pagina, /RUTA_CONTACTO/);
  });

  it("abre LinkedIn en otra pestaña sin regalarle la pestaña de origen", () => {
    // Se ancla en `href=` y no en la primera mención: el enlace aparece antes en
    // los datos estructurados (`sameAs`), y desde ahí el bloque no tendría ni
    // `target` ni `rel`.
    const bloque = pagina.slice(pagina.indexOf("href={FUNDADOR.linkedin}"));
    assert.match(bloque.slice(0, 400), /target="_blank"/);
    assert.match(bloque.slice(0, 400), /rel="noopener noreferrer"/);
  });
});

describe("se llega a la página desde donde se dijo", () => {
  it("el pie la enlaza", () => {
    assert.match(leer("components/Footer.tsx"), /href="\/quienes-somos"/);
  });

  it("la portada la enlaza desde la sección de confianza", () => {
    assert.match(leer("components/ComoFunciona.tsx"), /href="\/quienes-somos"/);
  });

  it("el mapa del sitio la anuncia", () => {
    assert.match(leer("app/sitemap.ts"), /"\/quienes-somos"/);
  });

  it("la portada no repite la promesa de la visita al añadir el enlace", () => {
    // La sección de confianza es el único sitio de la portada que puede enunciar
    // la visita en sitio (ver `pruebas/lista-espera.prueba.ts`). El enlace nuevo
    // se añadió ahí dentro, así que el reparto sigue intacto.
    const promesa = /visitamos|inspeccionamos|estuvo físicamente/i;
    const portada = ["components/Hero.tsx", "components/Footer.tsx", "components/ListaDeEspera.tsx"];
    for (const ruta of portada) {
      assert.doesNotMatch(leer(ruta), promesa, `${ruta} volvió a enunciar la visita en sitio`);
    }
  });
});
