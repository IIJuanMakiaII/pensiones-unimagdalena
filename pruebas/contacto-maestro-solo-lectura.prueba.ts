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

  it("la acción del maestro no lee el número del formulario", () => {
    // La segunda mitad de la garantía, y la que de verdad impide la pérdida: aunque
    // el campo se pintara por error, si el servidor no lo lee, no hay nada que
    // sobrescribir. `CAMPO_WHATSAPP` es «whatsappPrivado»; se comprueban las dos
    // formas para no depender de cuál se use.
    const accion = sinComentarios(leer(ACCION_MAESTRO));
    assert.doesNotMatch(
      accion,
      /CAMPO_WHATSAPP|whatsappPrivado/,
      "la acción del maestro lee el WhatsApp del formulario: el maestro guardaría el número del anfitrión como vacío"
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
});
