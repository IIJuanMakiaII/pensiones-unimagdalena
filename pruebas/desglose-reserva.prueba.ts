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
