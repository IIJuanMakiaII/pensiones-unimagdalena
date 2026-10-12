/**
 * «Quiénes somos»: la página, su identidad y sus enlaces.
 *
 * Se prueba en seis frentes, y cada uno protege algo que se rompe en silencio:
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
 *   5. **El texto es el que el fundador escribió.** La versión nueva la redactó él
 *      y se publica literal, con sus cuatro pasos y sus dos secciones nuevas. Sus
 *      frases se declaran arriba y se comparan enteras: si alguien las reescribe,
 *      la prueba dice cuál cambió, en vez de dar por bueno un fragmento.
 *   6. **La maquetación que pidió.** «Por qué lo hago» va a la derecha de la foto,
 *      dentro de la misma fila. Es una petición explícita y se comprueba como tal:
 *      que el bloque esté después de la foto no bastaría —podría estar debajo—.
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

/**
 * El código con los espacios colapsados.
 *
 * El texto visible se parte en varias líneas para que quepa en el editor, y JSX
 * convierte cada salto en un espacio. Sin esto, comprobar una frase literal
 * exigiría escribir el salto de línea exacto del archivo, y la prueba se volvería
 * frágil ante cualquier reformateo.
 */
const plano = (fuente: string) => fuente.replace(/\s+/g, " ");

const PAGINA = "app/quienes-somos/page.tsx";

/**
 * Los textos del fundador, literales. Se declaran aquí para que la prueba diga
 * «esto es lo que había que publicar» en lugar de comprobar fragmentos sueltos: si
 * alguien los reescribe, la prueba tiene que decir cuál cambió.
 *
 * La errata corregida está declarada: su borrador decía «7 dias» y aquí va «7 días».
 */
const TEXTOS = {
  entradilla:
    "Nido nació de un problema que conocemos los estudiantes que venimos de otras ciudades: buscar dónde vivir entre grupos de WhatsApp, fotos que no coinciden y el miedo a que sea una estafa.",
  porquePrimero:
    "A un amigo cercano lo estafaron buscando pensión en Santa Marta: pagó por una habitación que no era como se la habían mostrado. Ver lo que le pasó me hizo entender que el problema es real y que le puede pasar a cualquier estudiante que llega de otra ciudad.",
  porqueSegundo:
    "Mi meta es sencilla: que los estudiantes encuentren una pensión de forma segura, y que sus familias puedan decidir con tranquilidad aunque estén lejos.",
  cierreDePasos:
    "Si te interesa un anuncio que aún no tiene sello, no pasa nada: me escribes, lo visito primero y te aviso. Solo se puede reservar cuando ya lo verifiqué. Te respondo en máximo 24h y hago la visita en 7 días.",
  reembolso:
    "y te respondo en máximo 24h. Si el propietario cancela o la habitación no es como la mostré, te devuelvo tu reserva completa.",
  enlaceReembolso: "Consulta la política de reembolso completa.",
  quienEstaDetras:
    "Nido es un proyecto que estoy arrancando como estudiante. Yo diseñé y programé la plataforma, y yo visito cada inmueble que lleva el sello. Si tienes dudas, hablas directamente conmigo.",
};

/** Los cuatro pasos, con el título y el detalle que escribió el fundador. */
const PASOS_ESPERADOS: ReadonlyArray<readonly [string, string]> = [
  ["Buscas por barrio y precio", "Filtras y ves a cuántos minutos a pie queda del campus."],
  [
    "Me escribes por WhatsApp",
    "Me cuentas qué buscas. Hablo yo con el propietario para confirmar qué hay disponible y conocerlo.",
  ],
  [
    "Visito y sello",
    "Voy en persona al inmueble. Compruebo que quien publica es el propietario o tiene su autorización, y que todo coincide con las fotos y con lo que me dijo. Si es así, el anuncio recibe el sello «Verificado por Nido ✓» con su fecha.",
  ],
  [
    "Reservas el primer mes",
    "Pagas la reserva con mi acompañamiento, y el saldo restante se lo entregas al propietario al llegar.",
  ],
];

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

describe("los textos del fundador · literales, completos y en su orden", () => {
  const pagina = plano(leer(PAGINA));

  it("el encabezado y la entradilla son los suyos, y el nombre sale del módulo", () => {
    assert.match(
      pagina,
      /Soy \{FUNDADOR\.nombreDePila\}, y creé Nido para que buscar pensión en Santa Marta no dé miedo/
    );
    assert.match(pagina, /Estudio \{FUNDADOR\.estudio\}\./);
    assert.ok(pagina.includes(TEXTOS.entradilla), "la entradilla no es la del fundador");
  });

  it("los dos botones llevan los rótulos que pidió", () => {
    assert.match(pagina, />\s*Escríbeme por WhatsApp\s*</);
    assert.match(pagina, />\s*Ver habitaciones\s*</);
  });

  it("los cuatro pasos están, con su título y su detalle, y en ese orden", () => {
    const posiciones = PASOS_ESPERADOS.map(([titulo, detalle]) => {
      assert.ok(pagina.includes(titulo), `falta el paso «${titulo}»`);
      assert.ok(pagina.includes(detalle), `el detalle de «${titulo}» no es el suyo`);
      return pagina.indexOf(titulo);
    });
    assert.deepEqual(
      posiciones,
      [...posiciones].sort((a, b) => a - b),
      "los pasos no están en el orden del fundador"
    );
  });

  it("el cuarto paso existe: es el que no estaba en la versión de tres", () => {
    assert.ok(pagina.includes("Reservas el primer mes"));
  });

  it("el cierre de la sección va con la errata corregida", () => {
    assert.ok(pagina.includes(TEXTOS.cierreDePasos), "el cierre de los pasos no es el suyo");
    // Su borrador escribía «7 dias». Se corrige la tilde y se declara; lo que no
    // puede quedar es la errata publicada.
    assert.doesNotMatch(pagina, /7 dias/);
  });

  it("«Por qué lo hago» lleva sus dos párrafos", () => {
    assert.match(pagina, />\s*Por qué lo hago\s*</);
    assert.ok(pagina.includes(TEXTOS.porquePrimero), "falta el párrafo de la estafa");
    assert.ok(pagina.includes(TEXTOS.porqueSegundo), "falta el párrafo de la meta");
  });

  it("«Si algo sale mal» existe y ofrece el reembolso con su enlace", () => {
    assert.match(pagina, />\s*Si algo sale mal\s*</);
    assert.ok(pagina.includes(TEXTOS.reembolso), "el texto del reembolso no es el suyo");
    assert.ok(pagina.includes(TEXTOS.enlaceReembolso), "falta la frase que él pidió enlazar");
    // La frase enlaza a las condiciones y conserva su rótulo exacto: ni «ver
    // política» ni «más información». La promesa del reembolso vive en ese
    // documento, así que el enlace es parte de la afirmación, no un adorno.
    assert.match(
      pagina,
      /href=\{RUTA_CONDICIONES\}[\s\S]{0,200}Consulta la política de reembolso completa\./
    );
  });

  it("«Quién está detrás» es el suyo, y el enlace mantiene su rótulo", () => {
    assert.ok(
      pagina.includes(TEXTOS.quienEstaDetras),
      "el texto de quién está detrás no es el suyo"
    );
    assert.match(pagina, /Mi perfil en LinkedIn/);
  });

  it("«Hablemos» nombra las dos vías", () => {
    assert.match(pagina, /¿Buscas pensión o tienes una para publicar\? Escríbeme por/);
    assert.match(pagina, /mailto:\$\{FUNDADOR\.correo\}/);
  });

  it("las secciones van en el orden del fundador", () => {
    const orden = [
      "Por qué lo hago",
      "Cómo funciona Nido",
      "Si algo sale mal",
      "Quién está detrás",
      "Hablemos",
    ];
    const posiciones = orden.map((titulo) => pagina.indexOf(titulo));
    for (const [indice, posicion] of posiciones.entries()) {
      assert.ok(posicion > -1, `falta la sección «${orden[indice]}»`);
    }
    assert.deepEqual(
      posiciones,
      [...posiciones].sort((a, b) => a - b),
      "las secciones no siguen el orden que escribió el fundador"
    );
  });
});

describe("la maquetación pedida · «Por qué lo hago» al lado derecho de la foto", () => {
  const pagina = leer(PAGINA);

  it("la foto y el bloque van en la misma fila", () => {
    // En móvil la fila se apila —foto arriba, texto debajo, que es el orden de
    // lectura natural en un teléfono—; desde 768 px se acuesta.
    assert.match(pagina, /flex flex-col gap-6 md:flex-row/);
  });

  it("el bloque queda dentro de esa fila y después de la foto", () => {
    const fila = pagina.indexOf("flex flex-col gap-6 md:flex-row");
    const foto = pagina.indexOf("<Image");
    const cierre = pagina.indexOf("</section>", pagina.indexOf("Por qué lo hago"));

    assert.ok(fila > -1 && foto > -1 && cierre > -1, "no se encontró la fila, la foto o el bloque");
    assert.ok(fila < foto, "la fila no abre antes de la foto");
    assert.ok(foto < cierre, "«Por qué lo hago» quedaría encima de la foto");

    // Que esté después no basta: podría estar debajo, en otra fila. Tiene que caer
    // dentro del mismo contenedor que la foto.
    const dentroDeLaFila = pagina.slice(fila, cierre);
    assert.match(dentroDeLaFila, /<Image/);
    assert.match(dentroDeLaFila, /Por qué lo hago/);
  });

  it("el bloque ocupa la columna derecha y no se pega al ancho de la foto", () => {
    // `md:flex-1` es lo que lo convierte en la segunda columna: sin él, en pantalla
    // ancha el texto se quedaría estrecho junto al retrato.
    assert.match(pagina, /aria-labelledby="titulo-por-que-lo-hago"[^>]*md:min-w-0 md:flex-1/);
  });

  it("la foto conserva su marco y su espacio reservado", () => {
    assert.match(pagina, /aspect-\[4\/5\]/);
    assert.match(pagina, /shrink-0/);
  });
});
