/**
 * El reparto del Depósito de Reserva (`lib/pension.ts`), atado a la tabla legal.
 *
 * Dos cosas se prueban aquí, y la segunda es la que más valor tiene:
 *
 *  1. Que las cuentas cierren siempre: `tarifa + seña === depósito` y
 *     `depósito + saldo === canon`, incluso con precios que no son múltiplos de
 *     10 (donde dos redondeos por separado dejarían un peso suelto).
 *  2. Que las cifras del **ejemplo que está escrito en el documento legal** salgan
 *     exactamente de esta función. Es la atadura que evita lo peor: que el sitio
 *     enseñe un reparto y el contrato que firma el estudiante diga otro. Si alguien
 *     cambia los porcentajes en un lado y no en el otro, esta prueba se pone roja.
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
    const { canon, deposito, tarifaServicio, sena, saldoAlLlegar } = desgloseReserva(1_000_000);
    assert.equal(canon, 1_000_000);
    assert.equal(deposito, 200_000, "el 20 % del canon");
    assert.equal(tarifaServicio, 100_000, "el 10 % para la plataforma");
    assert.equal(sena, 100_000, "el otro 10 % para el propietario");
    assert.equal(saldoAlLlegar, 800_000, "el 80 % al llegar");
  });

  it("la tarifa más la seña son exactamente la reserva", () => {
    for (const canon of [600_000, 1_000_000, 850_000, 633_333, 1, 999_999, 12_345_678]) {
      const d = desgloseReserva(canon);
      assert.equal(d.tarifaServicio + d.sena, d.deposito, `no cuadra con ${canon}`);
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
    assert.equal(d.tarifaServicio + d.sena, d.deposito);
  });
});

describe("las cifras coinciden con la tabla del documento legal", () => {
  const condiciones = readFileSync(join(raiz, "docs", "legales", "condiciones-de-uso.md"), "utf8");
  const autorizacion = readFileSync(join(raiz, "docs", "legales", "autorizacion-anfitrion.md"), "utf8");
  const ejemplo = desgloseReserva(1_000_000);

  it("el documento usa el mismo ejemplo de $1.000.000", () => {
    assert.ok(condiciones.includes("1.000.000"), "las condiciones hablan del canon de $1.000.000");
  });

  it("los cuatro importes del ejemplo salen de la función", () => {
    const esperados = {
      tarifa: "$100.000",
      sena: "$100.000",
      total: "$200.000",
      saldo: "$800.000",
    };
    for (const [concepto, texto] of Object.entries(esperados)) {
      assert.ok(condiciones.includes(texto), `las condiciones deberían decir ${texto} (${concepto})`);
    }
    assert.equal(digitos(formatearCOP(ejemplo.tarifaServicio)), "100000");
    assert.equal(digitos(formatearCOP(ejemplo.sena)), "100000");
    assert.equal(digitos(formatearCOP(ejemplo.deposito)), "200000");
    assert.equal(digitos(formatearCOP(ejemplo.saldoAlLlegar)), "800000");
  });

  it("la tarifa queda como ingreso de la plataforma y la seña del propietario", () => {
    assert.match(condiciones, /Tarifa de Servicio de la Plataforma[\s\S]{0,400}ingreso propio/i);
    assert.match(condiciones, /Seña o Anticipo del Arrien\w+[\s\S]{0,200}propietario/i);
    assert.ok(autorizacion.includes("Tarifa de Servicio"), "la autorización nombra la tarifa");
    assert.ok(autorizacion.includes("Seña"), "la autorización nombra la seña");
  });
});
