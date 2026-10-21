/**
 * Los dos documentos legales que el sitio PUBLICA no pueden volver a salir en
 * estado de borrador.
 *
 * `components/DocumentoLegal.tsx` publica el archivo de `docs/legales/` **literal,
 * sin reescribirlo**: lo que diga el Markdown es exactamente lo que lee el
 * visitante. Un `[PENDIENTE]` o un «BORRADOR — NO PUBLICAR TODAVÍA» escrito como
 * nota de trabajo acaba, por tanto, en la calle tal cual.
 *
 * Y pasó: el sitio llevaba publicado «BORRADOR — NO PUBLICAR TODAVÍA» y veinticinco
 * marcadores `[PENDIENTE]` entre las dos páginas. Nadie lo vio porque el marcador
 * está en el fuente y el fuente se revisa; la página se lee.
 *
 * Estas pruebas miran **lo que se publica**, no lo que se escribe. Por eso cubren
 * solo los dos archivos que `app/legal/` sirve, y dejan fuera
 * `autorizacion-anfitrion.md` y `preguntas-para-el-abogado.md`: esos son documentos
 * internos de trabajo y sí pueden tener sus notas y sus pendientes.
 *
 * El enlace a un `.md` tiene comprobación propia. Es un fallo distinto y más
 * silencioso que un `[PENDIENTE]`: el enlace se ve bien en el editor, pero los
 * documentos internos viven en el repositorio, no en el sitio, así que en la página
 * publicada es un enlace roto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { markdownAHtml } from "@/lib/markdown-legal";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Los dos únicos documentos que `app/legal/` sirve, y su nombre para los mensajes. */
const PUBLICADOS = {
  condiciones: "docs/legales/condiciones-de-uso.md",
  "aviso de privacidad": "docs/legales/aviso-de-privacidad.md",
} as const;

/**
 * El documento con los saltos de línea ya colapsados. Sin esto, una frase partida
 * por el ancho del archivo haría fallar una comprobación que en pantalla se lee
 * perfectamente: la prueba mediría el formato, no el contenido.
 */
const leerPlano = (ruta: string) =>
  readFileSync(join(RAIZ, ruta), "utf8").replace(/\s+/g, " ");

describe("documentos legales publicados", () => {
  it("no sale ninguna nota interna de borrador", () => {
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      const texto = leerPlano(ruta);
      assert.doesNotMatch(texto, /BORRADOR|NO PUBLICAR/i, `${nombre}: sale el cartel de borrador`);
      assert.doesNotMatch(texto, /\[PENDIENTE/, `${nombre}: sale un marcador [PENDIENTE]`);
      // «sin revisión jurídica» era la firma del pie de estos documentos mientras
      // fueron borradores. NO se comprueba la frase «no se publica» a secas: aparece
      // en oraciones legítimas —«el número del propietario ya no se publica», «sin
      // ese mandato el anuncio no se publica»— y sería un falso positivo que acabaría
      // obligando a silenciar la comprobación. El marcador `[PENDIENTE` ya cubre las
      // notas internas, que es donde vivía esa instrucción.
      assert.doesNotMatch(
        texto,
        /sin revisi[oó]n jur[ií]dica|revisi[oó]n jur[ií]dica pendiente/i,
        `${nombre}: declara que aún no está revisado`
      );
    }
  });

  it("ningún enlace apunta a un archivo que el sitio no sirve", () => {
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      assert.doesNotMatch(
        leerPlano(ruta),
        /\]\([^)]*\.md\)/,
        `${nombre}: enlaza un .md interno, que en la página publicada es un enlace roto`
      );
    }
  });

  it("los dos llevan fecha de última actualización", () => {
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      assert.match(
        leerPlano(ruta),
        /\*\*Última actualización:\*\* \d{1,2} de [a-záéíóú]+ de \d{4}/,
        `${nombre}: sin fecha, el documento no dice a qué versión se está aceptando`
      );
    }
  });

  it("declaran quién responde por los datos y cómo reclamar", () => {
    // Un aviso sin identificación ni canal no sirve para ejercer nada: la Ley 1581
    // exige poder saber quién trata los datos y por dónde pedir su corrección.
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      const texto = leerPlano(ruta);
      assert.match(texto, /1004364753/, `${nombre}: no identifica al responsable`);
      assert.match(texto, /oterojuan15@gmail\.com/, `${nombre}: no da un canal de contacto`);
    }
  });

  it("la descripción del pago coincide con lo que el sitio hace hoy", () => {
    // El cobro en línea no está construido. Publicar la tabla del reparto sin decir
    // por dónde se paga hoy sería describir un servicio que todavía no existe, que
    // es la forma más rápida de perder la confianza de quien reserva.
    const condiciones = leerPlano(PUBLICADOS.condiciones);
    assert.match(condiciones, /se cierra por WhatsApp con la plataforma/i);
    assert.match(condiciones, /cobro en línea todav[ií]a no est[aá] habilitado/i);
  });

  it("usan «anticipo», no el vocabulario retirado «seña»", () => {
    // El límite de palabra es obligatorio: sin él, «contraseña» daría un falso
    // positivo y la prueba señalaría un texto que está bien.
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      assert.doesNotMatch(
        leerPlano(ruta),
        /(?<![A-Za-zÀ-ÿ])[Ss]eña(?![A-Za-zÀ-ÿ])/,
        `${nombre}: sigue usando «seña»`
      );
    }
  });

  it("el domicilio se lee igual en los dos documentos", () => {
    // Forma canónica que pidió el responsable: «Santa Marta - Magdalena - Colombia».
    // Se comprueba el texto del documento, no la página, porque la página publica
    // el documento tal cual.
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      const texto = leerPlano(ruta);
      assert.match(texto, /Santa Marta - Magdalena - Colombia/, `${nombre}: el domicilio no usa la forma canónica`);
      assert.doesNotMatch(texto, /Santa Marta\s*\/\s*Ci[eé]naga/, `${nombre}: queda el domicilio anterior`);
    }
  });
});

/**
 * El conversor de Markdown, medido sobre lo que se publica.
 *
 * Estas pruebas existen por dos defectos que el visitante veía y que ninguna
 * comprobación del fuente detectaba: 50 negritas publicadas como `**` literal y 161
 * líneas de continuación convertidas en párrafos sueltos. Se comprueban aquí porque
 * el defecto estaba en el conversor, no en los documentos.
 */
const htmlPublicado = (ruta: string) => markdownAHtml(readFileSync(join(RAIZ, ruta), "utf8"));

/** El texto visible de cada párrafo y de cada ítem de lista, sin etiquetas. */
function bloquesDeTexto(html: string): { etiqueta: string; texto: string }[] {
  return [...html.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/g)].map((coincidencia) => ({
    etiqueta: coincidencia[1],
    texto: coincidencia[2].replace(/<[^>]+>/g, "").trim(),
  }));
}

describe("el conversor no publica marcado roto ni párrafos partidos (tarea #125)", () => {
  it("ningún documento deja un `**` literal", () => {
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      const html = htmlPublicado(ruta);
      assert.doesNotMatch(html, /\*\*/, `${nombre}: se publica un ** literal`);
      assert.doesNotMatch(html, /\*/, `${nombre}: queda un asterisco suelto en el HTML publicado`);
    }
  });

  it("una negrita que cruza el salto de línea se resuelve en las dos frases que salían rotas", () => {
    const aviso = htmlPublicado(PUBLICADOS["aviso de privacidad"]);
    assert.match(
      aviso,
      /<strong[^>]*>Los datos de una reserva y de su pago se conservan el tiempo que exija la ley contable y tributaria<\/strong>/,
      "la negrita de la sección 6 sigue partida"
    );
    assert.match(
      aviso,
      /una herramienta que <strong[^>]*>no usa cookies<\/strong> y que <strong[^>]*>no identifica a personas<\/strong>/,
      "la negrita de la sección 5 sigue partida"
    );
  });

  it("ninguna línea de continuación abre un bloque propio", () => {
    // Una línea de continuación corta una frase a media palabra: si el conversor la
    // publica como bloque suelto, ese bloque no termina en puntuación. Es la
    // comprobación general, la que no depende de recordar una frase concreta.
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      for (const bloque of bloquesDeTexto(htmlPublicado(ruta))) {
        assert.match(
          bloque.texto,
          /[.:;?!)]$/,
          `${nombre}: un <${bloque.etiqueta}> termina a mitad de frase, señal de que se partió → «…${bloque.texto.slice(-70)}»`
        );
      }
    }
  });

  it("la lista de «Lo que NO guardamos» sigue siendo una lista y su ítem está entero", () => {
    const aviso = htmlPublicado(PUBLICADOS["aviso de privacidad"]);
    // «Los procesará la …» es la frase que en pantalla salía cortada. Si el ítem se
    // hubiera partido, aparecería en dos bloques —el ítem y un párrafo suelto— y el
    // segundo sin puntuación final, que es lo que comprueba la prueba anterior. Aquí
    // se comprueba además que el bloque que la contiene es un ítem de lista entero.
    const conPasarela = bloquesDeTexto(aviso).filter((bloque) => bloque.texto.includes("Los procesará la"));
    assert.equal(conPasarela.length, 1, "la frase de la pasarela aparece en más de un bloque: el ítem se partió");
    assert.equal(conPasarela[0].etiqueta, "li", "el ítem dejó de ser un ítem de lista");
    assert.match(conPasarela[0].texto, /pasarela de pagos/);
    assert.match(conPasarela[0].texto, /recibe el resultado de la operación/);
  });

  it("la cita de las condiciones conserva su tabla dentro de la cita", () => {
    const condiciones = htmlPublicado(PUBLICADOS.condiciones);
    // Se ancla en la frase de la cita del reparto y se busca hacia atrás: el
    // documento tiene dos citas y la primera es la del resumen.
    const ancla = condiciones.indexOf("El propietario recibe el 90");
    const desde = condiciones.lastIndexOf("<blockquote", ancla);
    const hasta = condiciones.indexOf("</blockquote>", ancla);
    assert.ok(ancla >= 0 && desde >= 0 && hasta > desde, "no se encontró la cita del reparto del primer mes");
    const cita = condiciones.slice(desde, hasta);
    assert.match(cita, /<table/, "la tabla del reparto se perdió al unir la cita");
    assert.match(cita, /La plataforma retiene/);
  });

  it("no se publica ningún salto duro: los documentos no usan dos espacios finales", () => {
    // Si algún día un documento los usara, esto avisaría de que el conversor no los
    // está respetando en lugar de dejar que el texto se una en silencio.
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      const fuente = readFileSync(join(RAIZ, ruta), "utf8");
      assert.doesNotMatch(fuente, / {2}\r?$/m, `${nombre}: usa dos espacios finales y el conversor no los convierte en salto`);
      assert.doesNotMatch(htmlPublicado(ruta), /<br\b/, `${nombre}: se publica un <br> que el fuente no pide`);
    }
  });
});

describe("el conversor, sobre casos mínimos", () => {
  it("une en un solo párrafo las líneas de una misma frase", () => {
    const html = markdownAHtml("una frase que\nsigue en la línea siguiente");
    assert.match(html, /^<p[^>]*>una frase que sigue en la línea siguiente<\/p>$/);
  });

  it("resuelve la negrita cuando el par cruza el salto de línea", () => {
    const html = markdownAHtml("**una negrita partida\npor el ancho del archivo** y texto suelto");
    assert.match(html, /<strong[^>]*>una negrita partida por el ancho del archivo<\/strong> y texto suelto/);
    assert.doesNotMatch(html, /\*/);
  });

  it("una línea suelta dentro de una lista continúa el ítem, no abre otro", () => {
    const html = markdownAHtml("- primer ítem\n  que continúa\n- segundo ítem");
    assert.equal((html.match(/<li/g) ?? []).length, 2, "la continuación abrió un ítem propio");
    assert.match(html, /<li[^>]*>primer ítem que continúa<\/li>/);
  });

  it("un encabezado cierra el párrafo anterior y no se le pega", () => {
    const html = markdownAHtml("texto del párrafo\n## 2. Un título\nmás texto");
    assert.equal((html.match(/<p /g) ?? []).length, 2);
    assert.match(html, /<h2[^>]*>2. Un título<\/h2>/);
  });

  it("una tabla sigue siendo una sola tabla con su cabecera", () => {
    const html = markdownAHtml("| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |");
    assert.equal((html.match(/<table/g) ?? []).length, 1);
    assert.equal((html.match(/<tr>/g) ?? []).length, 3, "cabecera + dos filas");
  });

  it("escapa el HTML del documento antes de añadir etiquetas", () => {
    const html = markdownAHtml("un <script> y un & suelto");
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&amp; suelto/);
    assert.doesNotMatch(html, /<script>/);
  });
});

describe("las páginas legales ya no anuncian un documento provisional (tarea #125)", () => {
  const PAGINAS = ["app/legal/privacidad/page.tsx", "app/legal/condiciones/page.tsx"];

  it("no queda el cartel de revisión ni ningún dato PENDIENTE", () => {
    for (const ruta of PAGINAS) {
      const fuente = readFileSync(join(RAIZ, ruta), "utf8");
      assert.doesNotMatch(fuente, /PENDIENTE/, `${ruta}: sigue nombrando datos PENDIENTE`);
      assert.doesNotMatch(fuente, /role="note"/, `${ruta}: queda el bloque de nota`);
      assert.doesNotMatch(
        fuente,
        /pendiente de revisi[oó]n jur[ií]dica/i,
        `${ruta}: sigue anunciando que el texto está pendiente`
      );
    }
  });

  it("los datos del responsable están completos en los dos documentos", () => {
    for (const [nombre, ruta] of Object.entries(PUBLICADOS)) {
      const texto = leerPlano(ruta);
      assert.match(texto, /Juan Sebastián Otero Cerchar/, `${nombre}: falta el nombre del responsable`);
      assert.match(texto, /1004364753/, `${nombre}: falta la identificación`);
      assert.match(texto, /oterojuan15@gmail\.com/, `${nombre}: falta el correo`);
    }
  });

  it("«Quién está detrás» publica el WhatsApp de la plataforma, no solo LinkedIn", () => {
    const fuente = readFileSync(join(RAIZ, "app/quienes-somos/page.tsx"), "utf8");
    // Se ancla en el encabezado de la tarjeta y no en el texto suelto: el nombre
    // aparece también en los comentarios de cabecera del archivo.
    const desde = fuente.indexOf(">Quién está detrás<");
    const hasta = fuente.indexOf("</section>", desde);
    assert.ok(desde >= 0 && hasta > desde, "no se encontró la tarjeta «Quién está detrás»");
    const tarjeta = fuente.slice(desde, hasta);
    assert.match(tarjeta, /Mi perfil en LinkedIn/);
    assert.match(tarjeta, /enlaceWhatsAppPlataforma\(/, "la tarjeta no ofrece el WhatsApp de la plataforma");
    assert.match(tarjeta, /rel="noopener noreferrer"/);
    assert.match(tarjeta, /target="_blank"/);
    // El número no se escribe en el código: sale de la variable de entorno. Un
    // número literal aquí volvería a ser el problema que la tarea #59 cerró.
    assert.doesNotMatch(tarjeta, /\b5?7?\d{9,15}\b/, "hay un número escrito a mano en la tarjeta");
  });
});
