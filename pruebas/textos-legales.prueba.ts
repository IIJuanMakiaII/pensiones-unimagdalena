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
});
