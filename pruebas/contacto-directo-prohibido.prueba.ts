/**
 * La prohibición de desviar el contacto, atada al documento que el sitio publica.
 *
 * El WhatsApp del anfitrión deja de ser un dato público y pasa a ser un **dato
 * privado**: lo registra él al publicar y solo lo ven él y el equipo de Nido. Pero una
 * regla que solo vive en el código es una regla que el usuario descubre cuando ya la
 * incumplió. Si el formulario rechaza un teléfono escrito en la descripción, las
 * Condiciones tienen que decir lo mismo **antes**, no después.
 *
 * Una cláusula que solo existe como prosa se borra sin que nadie se entere: el
 * articulado se revisa, la página se lee. Por eso esta prueba lee el documento del
 * disco —igual que `desglose-reserva.prueba.ts`— y exige que la prohibición exista y
 * que diga lo que tiene que decir.
 *
 * **Que esté dentro del párrafo de las prohibiciones importa, y por eso se comprueba
 * ahí y no en el documento entero:** es ese párrafo el que arrastra la consecuencia
 * («la plataforma puede retirar un anuncio o suspender una cuenta»). Una regla suelta
 * y amable al final del texto no la aplica nadie.
 *
 * Las distancias entre las ideas van acotadas (`[\s\S]{0,300}`) a propósito: no se
 * comprueba que las dos frases estén en algún lugar del documento, sino que estén
 * **juntas**, que es lo que las convierte en una sola regla y no en dos adornos.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONDICIONES = "docs/legales/condiciones-de-uso.md";

/**
 * El documento con los saltos de línea ya colapsados. Sin esto, una frase partida por
 * el ancho del archivo haría fallar una comprobación que en pantalla se lee
 * perfectamente: la prueba mediría el formato, no el contenido.
 */
const leerPlano = (ruta: string) =>
  readFileSync(join(RAIZ, ruta), "utf8").replace(/\s+/g, " ");

describe("las Condiciones prohíben desviar el contacto", () => {
  const documento = leerPlano(CONDICIONES);

  /** El párrafo de las prohibiciones: el que lleva la consecuencia aparejada. */
  const prohibiciones = (() => {
    const desde = documento.indexOf("## 9. Conducta prohibida");
    const hasta = documento.indexOf("## 10.");
    assert.ok(
      desde !== -1 && hasta > desde,
      "no se encontró la sección de conducta prohibida: ¿se renumeró el articulado?"
    );
    return documento.slice(desde, hasta);
  })();

  it("la prohibición existe y es sobre compartir contacto directo", () => {
    assert.match(
      prohibiciones,
      /prohibido[\s\S]{0,80}compartir, pedir o publicar datos de contacto directo/i,
      "las Condiciones no prohíben compartir datos de contacto directo"
    );
  });

  it("la prohibición está atada a evadir el servicio, no a compartir por compartir", () => {
    // El propietario prohibió desviar el contacto **para saltarse la plataforma**. Sin
    // esta comprobación, «prohibido compartir el teléfono» se leería como una regla de
    // privacidad y no como lo que es: la defensa del servicio que sostiene el sitio.
    assert.match(
      prohibiciones,
      /datos de contacto directo[\s\S]{0,300}evadir el servicio/i,
      "la cláusula no dice que la prohibición es para evadir el servicio"
    );
  });

  it("declara privado el WhatsApp que el anfitrión registra", () => {
    // La pata legal de que el número se pida en el formulario y no se muestre a nadie.
    assert.match(
      prohibiciones,
      /WhatsApp que el anfitrión registra[\s\S]{0,150}privado/i,
      "la cláusula no dice que el número registrado sea un dato privado"
    );
  });

  it("no prohíbe lo que el sitio hace: la plataforma es quien lleva el contacto", () => {
    // Falso positivo que hay que descartar a propósito: una redacción que prohibiera
    // «compartir el contacto» en abstracto chocaría con la sección 2, que dice que el
    // contacto lo lleva la plataforma. La cláusula debe seguir mencionando la sección
    // como su marco, no contradecirla.
    assert.match(
      prohibiciones,
      /los lleva la plataforma/i,
      "la cláusula no se apoya en que el contacto lo lleva la plataforma"
    );
  });

  it("el documento se publica en /legal/condiciones", () => {
    // De nada sirve la cláusula en el archivo si la página deja de servirlo. Es el
    // único enlace entre el texto firmado y lo que el visitante lee.
    const pagina = readFileSync(
      join(RAIZ, "app", "legal", "condiciones", "page.tsx"),
      "utf8"
    );
    assert.match(
      pagina,
      /DocumentoLegal\s+archivo="condiciones-de-uso\.md"/,
      "la página de condiciones ya no publica este documento"
    );
  });
});
