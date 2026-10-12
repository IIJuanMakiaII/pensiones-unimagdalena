/**
 * El reparto del Depósito de Reserva (`lib/pension.ts`), atado a la tabla legal.
 *
 * Dos cosas se prueban aquí, y la segunda es la que más valor tiene:
 *
 *  1. Que las cuentas cierren siempre: `tarifa + anticipo === depósito` y
 *     `depósito + saldo === canon`, incluso con precios que no son múltiplos de
 *     10 (donde dos redondeos por separado dejarían un peso suelto).
 *  2. Que las cifras del **ejemplo que está escrito en el documento legal** salgan
 *     exactamente de esta función. Es la atadura que evita lo peor: que el sitio
 *     enseñe un reparto y el contrato que firma el estudiante diga otro. Si alguien
 *     cambia los porcentajes en un lado y no en el otro, esta prueba se pone roja.
 *
 * El ejemplo vivo es el de `condiciones-de-uso.md` §3.1: canon de **$500.000**, con
 * $50.000 de tarifa, $50.000 de anticipo, $100.000 de reserva y $400.000 de saldo.
 * La versión anterior de esta prueba estaba clavada en un canon de $1.000.000; se
 * cambió junto con el documento, no antes, para que la prueba siga midiendo el
 * texto real y no una expectativa cómoda.
 *
 * El número de plataforma se inyecta antes de importar `lib/formato.ts` porque se
 * lee al cargar el módulo (misma precaución que en `whatsapp.prueba.ts`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "573009998888";

const { desgloseReserva } = await import("@/lib/pension");
const { formatearCOP } = await import("@/lib/formato");

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Los dígitos de un importe, sin símbolos ni separadores, para poder comparar. */
const digitos = (texto: string) => texto.replace(/\D/g, "");

describe("desgloseReserva · las cuentas cierran", () => {
  it("reparte el canon en 10 % / 10 % / 80 %", () => {
    const { canon, deposito, tarifaServicio, anticipo, saldoAlLlegar } = desgloseReserva(1_000_000);
    assert.equal(canon, 1_000_000);
    assert.equal(deposito, 200_000, "el 20 % del canon");
    assert.equal(tarifaServicio, 100_000, "el 10 % para la plataforma");
    assert.equal(anticipo, 100_000, "el otro 10 % para el propietario");
    assert.equal(saldoAlLlegar, 800_000, "el 80 % al llegar");
  });

  it("la tarifa más el anticipo son exactamente la reserva", () => {
    for (const canon of [600_000, 1_000_000, 850_000, 633_333, 1, 999_999, 12_345_678]) {
      const d = desgloseReserva(canon);
      assert.equal(d.tarifaServicio + d.anticipo, d.deposito, `no cuadra con ${canon}`);
    }
  });

  it("la reserva más el saldo son exactamente el canon", () => {
    for (const canon of [600_000, 1_000_000, 850_000, 633_333, 1, 999_999, 12_345_678]) {
      const d = desgloseReserva(canon);
      assert.equal(d.deposito + d.saldoAlLlegar, d.canon, `no cuadra con ${canon}`);
    }
  });

  it("un precio de cero no produce un depósito fantasma", () => {
    const d = desgloseReserva(0);
    assert.equal(d.deposito, 0);
    assert.equal(d.saldoAlLlegar, 0);
  });

  it("un precio negativo o decimal no rompe el reparto", () => {
    assert.equal(desgloseReserva(-500).canon, 0);
    const d = desgloseReserva(600_000.4);
    assert.equal(d.canon, 600_000);
    assert.equal(d.tarifaServicio + d.anticipo, d.deposito);
  });
});

describe("las cifras coinciden con la tabla del documento legal", () => {
  const condiciones = readFileSync(join(raiz, "docs", "legales", "condiciones-de-uso.md"), "utf8");
  const autorizacion = readFileSync(join(raiz, "docs", "legales", "autorizacion-anfitrion.md"), "utf8");
  const ejemplo = desgloseReserva(500_000);

  it("el documento usa el mismo ejemplo de $500.000", () => {
    assert.ok(condiciones.includes("500.000"), "las condiciones hablan del canon de $500.000");
  });

  it("los cuatro importes del ejemplo salen de la función", () => {
    const esperados = {
      tarifa: "$50.000",
      anticipo: "$50.000",
      total: "$100.000",
      saldo: "$400.000",
    };
    for (const [concepto, texto] of Object.entries(esperados)) {
      assert.ok(condiciones.includes(texto), `las condiciones deberían decir ${texto} (${concepto})`);
    }
    assert.equal(digitos(formatearCOP(ejemplo.tarifaServicio)), "50000");
    assert.equal(digitos(formatearCOP(ejemplo.anticipo)), "50000");
    assert.equal(digitos(formatearCOP(ejemplo.deposito)), "100000");
    assert.equal(digitos(formatearCOP(ejemplo.saldoAlLlegar)), "400000");
  });

  it("la tarifa queda como ingreso de la plataforma y el anticipo es del propietario", () => {
    assert.match(condiciones, /Tarifa de Servicio de la Plataforma[\s\S]{0,400}ingreso propio/i);
    assert.match(condiciones, /Anticipo del Arrien\w+[\s\S]{0,200}propietario/i);
    assert.ok(autorizacion.includes("Tarifa de Servicio"), "la autorización nombra la tarifa");
    assert.ok(autorizacion.includes("Anticipo del Arriendo"), "la autorización nombra el anticipo");
  });

  it("el documento base no arrastra el vocabulario retirado «seña»", () => {
    // En Colombia «anticipo» es la palabra de uso corriente para este contexto; la
    // instrucción del fundador fue retirar «seña» del articulado. Se comprueba con
    // límite de palabra para no chocar con «contraseña», que sí debe seguir ahí.
    for (const [nombre, texto] of [
      ["condiciones", condiciones],
      ["autorización", autorizacion],
    ] as const) {
      assert.doesNotMatch(
        texto,
        /(?<![A-Za-zÀ-ÿ])[Ss]eña(?![A-Za-zÀ-ÿ])/,
        `${nombre} no debería seguir usando «seña»`
      );
    }
  });
});

/**
 * La presentación del desglose (tarea #74): lo que el estudiante lee en la ficha.
 *
 * Se prueba sobre el **texto del componente** y no sobre su salida, porque el
 * bloque no tiene lógica propia: sus cifras salen de `desgloseReserva()` y de
 * `formatearCOP()`. Lo que hay que proteger es justamente eso —que nadie escriba un
 * importe a mano y que la ficha empiece a mentir en el próximo cambio de precio—,
 * más la suma dicha en voz alta, quién asume la tarifa, y que la aclaración que el
 * propietario pidió retirar no vuelva por la puerta de atrás.
 */
describe("la presentación del desglose · la suma y quién asume la tarifa", () => {
  const componente = readFileSync(join(raiz, "components", "DesgloseReserva.tsx"), "utf8");

  it("el total se compone con formatearCOP y no está escrito a mano", () => {
    assert.match(componente, /Pagas en total \{formatearCOP\(canon\)\}/);
    assert.doesNotMatch(
      sinComentarios(componente),
      /\$\s?\d/,
      "ninguna cifra en pesos puede estar escrita en el componente: sale de formatearCOP()"
    );
  });

  it("los dos momentos se componen con las cifras de la función y se leen como una suma", () => {
    assert.match(componente, /\{formatearCOP\(deposito\)\} hoy \+/);
    assert.match(componente, /\{formatearCOP\(saldoAlLlegar\)\} al llegar =/);
  });

  it("dice que no hay ningún pago adicional", () => {
    assert.match(componente, /no pagas ningún valor adicional/);
  });

  it("dice quién asume la tarifa, sin afirmar que el estudiante no la pague", () => {
    assert.match(componente, /la asume el propietario/);
    assert.match(componente, /recibe el 90 %/);
    assert.doesNotMatch(
      componente,
      /no la paga|es gratis|no paga la tarifa/i,
      "contradiría §3.1 de las condiciones, que dice que la tarifa se recauda del estudiante"
    );
  });

  it("las dos filas de la tabla legal siguen, con su destino", () => {
    assert.match(componente, /etiqueta="Tarifa de Servicio de la Plataforma"/);
    assert.match(componente, /destino="Remuneración de la plataforma"/);
    assert.match(componente, /etiqueta="Anticipo del Arriendo"/);
    assert.match(componente, /destino="Al propietario, abonado al primer mes"/);
  });

  it("la aclaración retirada no vuelve, ni en la ficha que lo monta", () => {
    const detalle = readFileSync(join(raiz, "components", "DetallePension.tsx"), "utf8");
    for (const [nombre, texto] of [
      ["DesgloseReserva.tsx", componente],
      ["DetallePension.tsx", detalle],
    ] as const) {
      assert.doesNotMatch(texto, /no es el arriendo/i, nombre);
      assert.doesNotMatch(texto, /el dinero de hoy/i, nombre);
    }
  });
});

/**
 * Quita comentarios de línea y de bloque respetando las cadenas, para poder
 * preguntar por el código sin que un ejemplo escrito en un comentario conteste por
 * él. Es el mismo criterio —y casi el mismo cuerpo— que usan
 * `pruebas/contacto-respaldo.prueba.ts`, `pruebas/sello.prueba.ts` y
 * `pruebas/panel-maestro.prueba.ts`; se repite aquí para no editar el archivo de
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
      while (
        i < codigoFuente.length &&
        !(codigoFuente[i] === "*" && codigoFuente[i + 1] === "/")
      )
        i += 1;
      i += 2;
      continue;
    }

    if (caracter === '"' || caracter === "'" || caracter === "`") comilla = caracter;
    salida += caracter;
    i += 1;
  }

  return salida;
}
