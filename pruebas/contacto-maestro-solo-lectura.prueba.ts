/**
 * El maestro ve el WhatsApp del anfitrión, pero no puede pisarlo (tarea #79).
 *
 * POR QUÉ ESTA PRUEBA MIRA EL CÓDIGO Y NO UN RENDER
 * -------------------------------------------------
 * La regla que hay que proteger no se ve en pantalla: se ve en lo que **no** se
 * monta y en lo que **no** se lee. El maestro abre el editor del anuncio, ve el
 * número y escribe al anfitrión. Lo que no puede pasar es que ese número acabe
 * viajando de vuelta al servidor, porque el maestro no tiene ninguno propio que
 * enseñar y guardar cualquier cambio lo sobrescribiría con nada, sin que nadie se
 * enterara.
 *
 * Esa garantía se apoya en dos hechos que sí se pueden comprobar sin credenciales:
 * que la ruta del maestro no pida el campo editable, y que la acción del maestro no
 * lo lea del formulario. Y hay un tercero, que es el que más fácil se rompe con el
 * tiempo: que la tarjeta no contenga ningún `<input>` —si algún día lo tuviera,
 * parecería editable, y el número se perdería al guardar cualquier otra cosa—.
 *
 * No hay ninguna prueba que cubriera estas piezas: `FormularioEditarPension`,
 * `PanelMaestro`, `maestro/[id]` y la tarjeta no aparecían en `pruebas/`. Sin esta
 * guarda, el día que alguien añada `mostrarWhatsapp` a la ruta del maestro —una
 * línea, y suena razonable: «el maestro también debería poder corregirlo»— el
 * defecto entraría en silencio y sin un solo test rojo.
 *
 * Lee los archivos del disco, igual que `contacto-directo-prohibido.prueba.ts` y
 * `panel-maestro.prueba.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const leer = (ruta: string) => readFileSync(join(RAIZ, ...ruta.split("/")), "utf8");

/** El código sin comentarios: lo que se comprueba es lo que se ejecuta, no lo que se explica. */
const sinComentarios = (codigo: string) =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAGINA_MAESTRO = "app/maestro/[id]/editar/page.tsx";
const ACCION_MAESTRO = "app/actions/maestro.ts";
const TARJETA = "components/ContactoAnfitrionPrivado.tsx";
const PANEL = "components/PanelMaestro.tsx";
const FORMULARIO = "components/FormularioEditarPension.tsx";
const CORREGIR = "components/CorregirWhatsappAnfitrion.tsx";
const CONTACTO_DEL_ANUNCIO = "lib/contacto-del-anuncio.ts";

/**
 * El cuerpo de una acción concreta dentro de un archivo con varias.
 *
 * Hace falta desde la tarea #80: `app/actions/maestro.ts` ahora contiene una acción
 * que **sí** lee el número —`corregirWhatsappDelAnfitrion`, cuyo único trabajo es
 * ese— y otra cuyo defecto es no leerlo nunca. Comprobar «el archivo no menciona el
 * campo» dejaría de significar lo que importa: la garantía es sobre **la acción que
 * guarda el anuncio**, no sobre el archivo.
 */
const bloqueDe = (codigo: string, funcion: string): string => {
  const desde = codigo.indexOf(`export async function ${funcion}`);
  assert.ok(desde !== -1, `no se encontró la acción ${funcion}: ¿se renombró?`);
  const siguiente = codigo.indexOf("export async function ", desde + 1);
  return codigo.slice(desde, siguiente === -1 ? undefined : siguiente);
};

describe("el maestro ve el WhatsApp del anfitrión sin poder pisarlo", () => {
  it("la ruta del maestro no pide el campo editable", () => {
    // El campo editable se monta con `mostrarWhatsapp`, y su valor viaja de vuelta
    // al servidor. En la ruta del maestro no puede estar: él no tiene número propio.
    const pagina = sinComentarios(leer(PAGINA_MAESTRO));
    assert.doesNotMatch(
      pagina,
      /mostrarWhatsapp/,
      "la ruta del maestro pide el campo editable del WhatsApp: el maestro sobrescribiría el número del anfitrión con nada"
    );
  });

  it("la ruta del maestro pasa la tarjeta de solo lectura", () => {
    const pagina = sinComentarios(leer(PAGINA_MAESTRO));
    assert.match(
      pagina,
      /contactoDelAnfitrion=\{contactoDelAnfitrion\}/,
      "la ruta del maestro dejó de pasar el contacto: el maestro no vería el número"
    );
  });

  it("lee el número del propietario del anuncio, no el suyo", () => {
    // El error más fácil de cometer en esta ruta: `user` es el maestro, así que
    // `leerContactoDelAnfitrion(user.id)` pediría el número de quien mira —que no
    // tiene— y el panel diría «este anfitrión no ha registrado su WhatsApp» sobre
    // alguien que sí lo dejó. Es la confusión que hace concluir lo contrario de lo
    // cierto, y por eso se comprueba en las dos direcciones.
    const pagina = sinComentarios(leer(PAGINA_MAESTRO));
    assert.match(
      pagina,
      /leerContactoDelAnfitrion\(\s*pension\.anfitrion_id\s*\)/,
      "la ruta del maestro ya no lee el contacto con el id del propietario del anuncio"
    );
    assert.doesNotMatch(
      pagina,
      /leerContactoDelAnfitrion\(\s*user\.id\s*\)/,
      "la ruta del maestro lee el contacto con el id del maestro en vez del propietario del anuncio"
    );
  });

  it("la acción que guarda el anuncio sigue sin leer el número", () => {
    // La segunda mitad de la garantía, y la que de verdad impide la pérdida: aunque
    // el campo se pintara por error, si el servidor no lo lee, no hay nada que
    // sobrescribir. `CAMPO_WHATSAPP` es «whatsappPrivado»; se comprueban las dos
    // formas para no depender de cuál se use.
    //
    // Se mira **solo esta acción**, y no el archivo entero, desde la #80: esa
    // garantía es del guardado del anuncio, no de todo `maestro.ts`.
    const accion = bloqueDe(sinComentarios(leer(ACCION_MAESTRO)), "actualizarPensionMaestro");
    assert.doesNotMatch(
      accion,
      /CAMPO_WHATSAPP|whatsappPrivado/,
      "la acción que guarda el anuncio lee el WhatsApp del formulario: guardaría el número del anfitrión como vacío"
    );
  });

  it("la tarjeta no contiene ningún campo de formulario", () => {
    // Es la característica, no un olvido: un `<input>` aquí aparentaría ser
    // editable. Tampoco puede haber un `<textarea>` ni un `<select>`.
    const tarjeta = sinComentarios(leer(TARJETA));
    assert.doesNotMatch(
      tarjeta,
      /<input|<textarea|<select/,
      "la tarjeta del WhatsApp privado contiene un campo de formulario: aparentaría ser editable"
    );
  });

  it("el botón de escribir es un enlace, no un botón de envío", () => {
    // La tarjeta vive **dentro** del `<form>` del editor en la ruta del maestro. Un
    // `<button>` sin `type` enviaría el formulario al pulsarlo: el maestro creería
    // que abre WhatsApp y en realidad guardaría el anuncio.
    const tarjeta = sinComentarios(leer(TARJETA));
    assert.doesNotMatch(
      tarjeta,
      /<button/,
      "la tarjeta usa un botón: dentro del formulario del editor, pulsarlo enviaría el formulario"
    );
    assert.match(
      tarjeta,
      /<a\s[\s\S]{0,400}?href=\{contacto\.enlace\}/,
      "el botón de escribir al anfitrión dejó de ser un enlace al número"
    );
  });

  it("el enlace se construye en el servidor y llega hecho", () => {
    // La tarjeta es de cliente y no puede importar el módulo que habla con la base
    // (arrastra `next/headers` y la compilación lo rechaza). Si la URL se armara a
    // mano aquí, un enlace mal formado haría creer al maestro que escribió.
    const tarjeta = sinComentarios(leer(TARJETA));
    assert.doesNotMatch(
      tarjeta,
      /wa\.me|enlaceParaEscribirAlAnfitrion/,
      "la tarjeta arma la URL de WhatsApp por su cuenta: el enlace tiene que llegar resuelto desde el servidor"
    );
  });

  it("la tarjeta es una sola, compartida por el panel y el editor", () => {
    // Dos copias de la misma frase de privacidad es exactamente cómo una de las dos
    // acaba diciendo algo que ya no es verdad.
    const panel = sinComentarios(leer(PANEL));
    const formulario = sinComentarios(leer(FORMULARIO));

    for (const [nombre, codigo] of [
      ["el panel maestro", panel],
      ["el formulario de edición", formulario],
    ] as const) {
      assert.match(
        codigo,
        /import ContactoAnfitrionPrivado from "@\/components\/ContactoAnfitrionPrivado"/,
        `${nombre} dejó de importar la tarjeta compartida`
      );
    }

    assert.doesNotMatch(
      panel,
      /function ContactoDelAnfitrion/,
      "el panel maestro volvió a definir su propia tarjeta: la frase de privacidad podría divergir de la del editor"
    );
  });

  it("el editor solo pinta la tarjeta cuando la ruta se la entrega", () => {
    // En el alta y en la ruta del anfitrión no hay tarjeta de solo lectura: allí el
    // número se edita. Si se pintara siempre, dos bloques hablarían del mismo dato
    // en la misma pantalla.
    const formulario = sinComentarios(leer(FORMULARIO));
    assert.match(
      formulario,
      /contactoDelAnfitrion\s*&&/,
      "el editor pinta la tarjeta sin comprobar que la ruta se la haya entregado"
    );
  });

  /**
   * A partir de aquí, la corrección del número (tarea #80).
   *
   * Lo que se protege es la diferencia entre **corregir y falsificar**: que el
   * maestro pueda arreglar el número del anfitrión de un anuncio, y no pueda
   * escribirle un número a cualquier anfitrión eligiéndolo desde el formulario.
   */
  it("la corrección resuelve el destinatario desde el anuncio, en su propio módulo", () => {
    /*
     * El destinatario se resuelve en `lib/contacto-del-anuncio.ts`, no en la acción,
     * porque la superficie del maestro tiene prohibido nombrar al propietario y esa
     * prohibición la vigila otra prueba (`panel-maestro.prueba.ts`). Aquí se
     * comprueba lo que ese módulo sí tiene que hacer: buscar el propietario del
     * anuncio y escribirle **a ese**, no a otro.
     */
    const modulo = sinComentarios(leer(CONTACTO_DEL_ANUNCIO));

    assert.match(
      modulo,
      /\.from\("pensiones"\)[\s\S]{0,120}?anfitrion_id/,
      "la corrección no busca el propietario del anuncio: ¿de dónde saca a quién escribirle?"
    );
    assert.match(
      modulo,
      /corregirContactoDeOtroAnfitrion\(\s*data\.anfitrion_id/,
      "la corrección no pasa a la función que escribe el propietario que acaba de resolver"
    );
  });

  it("la corrección del panel delega, y no recibe el destinatario por ningún lado", () => {
    // Lo que se protege es la forma de la llamada: la acción entrega **el anuncio** y
    // nada más. Si aquí apareciera un id de propietario, vendría de un formulario.
    const accion = bloqueDe(sinComentarios(leer(ACCION_MAESTRO)), "corregirWhatsappDelAnfitrion");

    assert.match(
      accion,
      /corregirWhatsappDelAnuncio\(\s*pensionId,\s*valor,\s*guardia\.supabase\s*\)/,
      "la corrección no entrega el anuncio al módulo que resuelve el destinatario"
    );
    assert.doesNotMatch(
      accion,
      /anfitrion_id/,
      "la acción del maestro nombra al propietario: administra por `id`, y aquí no tiene nada que hacer con dueños"
    );
  });

  it("un número mal formado se rechaza sin consultar la base", () => {
    // La restricción de la tabla respondería `23514` sin decirle a nadie qué escribir.
    // El orden importa: validar primero, preguntar después.
    const modulo = sinComentarios(leer(CONTACTO_DEL_ANUNCIO));

    const validacion = modulo.indexOf("numeroDeAnfitrionValido(");
    const consulta = modulo.indexOf('.from("pensiones")');

    assert.ok(validacion !== -1, "la corrección no valida el número antes de escribir");
    assert.ok(
      validacion < consulta,
      "la corrección consulta la tabla antes de validar el número: un valor inválido llegaría a la base"
    );
  });

  it("la corrección exige el perfil maestro antes de tocar nada", () => {
    // Igual que las otras cuatro escrituras del panel. La RLS también lo exige, pero
    // una acción que no pregunta por el rol deja el permiso delegado por completo en
    // la base, y esto escribe el teléfono de otra persona.
    const accion = bloqueDe(sinComentarios(leer(ACCION_MAESTRO)), "corregirWhatsappDelAnfitrion");

    const guardia = accion.indexOf("exigirMaestro()");
    const escritura = accion.indexOf("corregirWhatsappDelAnuncio(");

    assert.ok(guardia !== -1, "la corrección no comprueba que quien la envía sea maestro");
    assert.ok(
      guardia < escritura,
      "la corrección escribe antes de comprobar el perfil: la guardia tiene que ir primero"
    );
  });

  it("el formulario de corrección manda al anuncio, nunca al anfitrión", () => {
    // Si aquí apareciera un campo con el id del anfitrión, cualquiera con el perfil
    // maestro podría reescribirle el número a quien eligiera: la RLS lo aceptaría,
    // porque al maestro le concede cualquier fila.
    const componente = sinComentarios(leer(CORREGIR));

    assert.match(
      componente,
      /name="pensionId"/,
      "el formulario de corrección no manda el anuncio que se está corrigiendo"
    );
    assert.doesNotMatch(
      componente,
      /anfitrion_id|anfitrionId/,
      "el formulario de corrección manda el destinatario: el maestro podría escribirle el número a cualquier anfitrión"
    );
  });

  it("la corrección llega precargada con el número vigente", () => {
    // El defecto seguro de esta acción es el contrario que el del guardado: aquí el
    // campo **no** puede llegar vacío, porque guardar lo sustituiría por nada.
    const componente = sinComentarios(leer(CORREGIR));
    assert.match(
      componente,
      /defaultValue=\{whatsappActual\}/,
      "el campo de corrección no llega con el número actual: guardar sin escribir podría dejarlo vacío"
    );
  });

  it("la tarjeta no sabe qué le cuelga cada pantalla", () => {
    // La tarjeta recibe un nodo hecho y no monta nada por su cuenta. Si conociera al
    // componente de edición, tendría un campo dentro —justo lo que la hace segura
    // dentro del `<form>` de la pantalla de edición—, y la primera prueba de este
    // archivo saltaría.
    const tarjeta = sinComentarios(leer(TARJETA));
    assert.doesNotMatch(
      tarjeta,
      /CorregirWhatsappAnfitrion/,
      "la tarjeta acopló el bloque de corrección en vez de recibirlo hecho"
    );
  });

  it("solo se ofrece corregir cuando hay un número que corregir", () => {
    // El caso que describió el propietario es «el anfitrión me dice que cambió de
    // número», y eso exige que antes hubiera uno. Sin esta condición, el panel
    // ofrecería inventarle un teléfono a un anfitrión que no ha dejado ninguno.
    const panel = sinComentarios(leer(PANEL));
    assert.match(
      panel,
      /contacto\.estado === "ok"[\s\S]{0,200}?CorregirWhatsappAnfitrion/,
      "el panel ofrece corregir el número aunque no haya ninguno registrado"
    );
  });
});
