/**
 * La ficha dibuja UNA sola galería (tarea #75).
 *
 * **El defecto que se vigila aquí.** La ficha tenía dos superficies de fotos
 * alimentadas por la misma fuente: una portada suelta con
 * `imagenPrincipal(pension)` y un carrusel con `galeriaDe(pension)`, y ambas
 * devuelven la MISMA primera foto (`lib/pension.ts:16-24`). Resultado: la foto 1
 * salía dos veces —arriba y como primera diapositiva— en cualquier anuncio con
 * al menos una foto. No era un problema de datos ni de las fotos subidas.
 *
 * **Por qué una prueba estructural y no una de comportamiento.** Las dos
 * superficies vivían en el marcado de la página, y hoy ninguna prueba del
 * proyecto ancla esa zona; sin esta, quitar la duplicación no dejaría ninguna
 * red que impida reponerla. Se afirma sobre el código sin comentarios, porque
 * los propios archivos explican en su prosa lo que ya no hacen.
 *
 * La comprobación equivalente sobre el HTML construido vive en
 * `scripts/verificar-seo.mjs` (la portada suelta no debe reaparecer en la ficha
 * prerenderizada). Esta es la que corre sin compilar.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Quita los comentarios antes de afirmar nada sobre un archivo.
 *
 * No es cosmética: una de estas comprobaciones es del tipo «esto **no**
 * aparece», y el propio bloque nuevo de la ficha cuenta por escrito qué se
 * quitó. Sin quitar los comentarios, la afirmación mediría la explicación en vez
 * del código, y el comentario que documenta la ausencia haría fallar la prueba
 * que la vigila.
 *
 * Respeta las cadenas ('…', "…", `…`) para no confundir una barra dentro de un
 * texto con el comienzo de un comentario. Es el mismo criterio que usan
 * `pruebas/sello.prueba.ts` y `pruebas/panel-maestro.prueba.ts`; se repite aquí
 * para no editar el archivo de otra tarea mientras su dueño lo está tocando.
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

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ...ruta.split("/")), "utf8"));

/** Cuenta las apariciones de un texto literal. */
const contar = (codigo: string, texto: string) => codigo.split(texto).length - 1;

/**
 * El texto que va DESDE una marca hasta la marca de cierre indicada, ambas
 * incluidas. Sirve para preguntar por las props de un componente concreto sin
 * confundirlas con las de otro hermano.
 */
function bloqueHasta(codigo: string, desde: string, cierre: string): string {
  const inicio = codigo.indexOf(desde);
  if (inicio < 0) return "";
  const fin = codigo.indexOf(cierre, inicio);
  return fin < 0 ? codigo.slice(inicio) : codigo.slice(inicio, fin + cierre.length);
}

describe("la ficha · una sola galería de fotos (tarea #75)", () => {
  const ficha = leer("app/pensiones/[id]/page.tsx");

  it("monta exactamente un carrusel", () => {
    assert.equal(
      contar(ficha, "<Carrusel"),
      1,
      "La ficha debe dibujar un único carrusel: dos superficies de fotos es justo el defecto que devuelve la foto 1 duplicada.",
    );
  });

  it("no vuelve a dibujar una portada suelta con la misma foto", () => {
    // La portada independiente era un `<FotoMarco>` alimentado por `principal`.
    // `FotoMarco` no se usa en ningún otro sitio de esta página: su reaparición
    // aquí significa que la duplicación ha vuelto.
    assert.equal(
      contar(ficha, "<FotoMarco"),
      0,
      "La ficha usa un único carrusel (que ya monta FotoMarco por dentro). Un <FotoMarco> suelto aquí es la portada duplicada que se quitó.",
    );

    // `imagenPrincipal` sigue siendo legítima en `generateMetadata` (Open Graph
    // y Twitter). Lo que no puede volver es su uso en el cuerpo de la página.
    assert.equal(
      contar(ficha, "imagenPrincipal(pension)"),
      1,
      "imagenPrincipal(pension) debe aparecer solo en generateMetadata (Open Graph). Una segunda aparición es la portada del cuerpo otra vez.",
    );
  });

  it("la galería única va arriba, antes del contenido de la página", () => {
    const galeria = ficha.indexOf("<Carrusel");
    const migas = ficha.indexOf("<Migas");

    assert.ok(galeria > 0, "No se encontró el carrusel en la ficha.");
    assert.ok(migas > 0, "No se encontraron las migas en la ficha.");
    assert.ok(
      galeria < migas,
      "El carrusel debe ir por delante de las migas: ocupa el hueco que dejó la portada, en la parte superior.",
    );
  });

  it("la imagen principal conserva `priority` y declara su ancho real", () => {
    const carrusel = bloqueHasta(ficha, "<Carrusel", "/>");

    assert.ok(carrusel.length > 0, "No se pudo aislar el bloque del carrusel.");
    assert.match(
      carrusel,
      /\bpriority\b/,
      "El carrusel hereda el papel de imagen principal: sin `priority` deja de precargarse y de ser la candidata a LCP.",
    );
    assert.match(
      carrusel,
      /sizes=/,
      "El carrusel de la ficha ocupa el ancho completo de la página, no el tercio de una tarjeta: debe declarar sus propios `sizes`.",
    );
  });

  it("el botón «Volver» sigue en su sitio y apunta al catálogo", () => {
    assert.match(ficha, /href="\/#resultados"/, "El botón «Volver» perdió su destino: /#resultados.");
    assert.match(ficha, />\s*Volver\s*<\/Link>/, "El botón «Volver» desapareció de la parte superior de la ficha.");
    assert.match(
      ficha,
      /className="absolute left-4 top-4[^"]*"/,
      "El botón «Volver» va superpuesto a la galería, como estaba sobre la portada.",
    );
  });

  it("la metadata sigue anunciando la imagen principal", () => {
    assert.match(
      ficha,
      /images:\s*\[\{\s*url:\s*principal/,
      "Las Open Graph deben seguir anunciando la imagen principal del anuncio.",
    );
  });

  it("el carrusel del catálogo conserva su ancho de tarjeta por defecto", () => {
    // El carrusel es compartido con `CardPension`. La prop `sizes` que estrena
    // la ficha es opcional y su valor por defecto tiene que seguir siendo el de
    // las tarjetas, o el catálogo empezaría a pedir imágenes del tamaño
    // equivocado en cada tarjeta.
    const carrusel = leer("components/Carrusel.tsx");

    assert.match(
      carrusel,
      /const TAMANOS_TARJETA = "\(max-width: 768px\) 100vw, \(max-width: 1280px\) 50vw, 33vw";/,
      "El ancho por defecto del carrusel (el de las tarjetas del catálogo) cambió.",
    );
    assert.match(
      carrusel,
      /sizes = TAMANOS_TARJETA/,
      "`sizes` debe ser opcional y caer en el valor de las tarjetas cuando nadie lo pasa.",
    );
  });
});
