/**
 * A quién le llega la reserva (`lib/formato.ts`).
 *
 * Es el único canal de conversión del producto y, desde el cambio de modelo del
 * 2026-10-02, tiene una sola respuesta: **la plataforma**. El anfitrión ya no
 * publica su número, así que aquí se defienden dos cosas:
 *
 *  1. El enlace apunta al número de la plataforma, con su código de país.
 *  2. Un anuncio antiguo que todavía tenga el número del dueño guardado en la
 *     base **no** puede desviar el contacto.
 *
 * El segundo caso se prueba con un objeto al que se le añade el campo a la fuerza
 * (`comoHeredada`), porque el tipo del producto ya no lo admite — y eso es
 * precisamente lo que se quiere: si lo admitiera, el número del dueño volvería a
 * viajar al navegador dentro del HTML de la página.
 *
 * El número de la plataforma se inyecta ANTES de importar el módulo porque se
 * lee al cargarlo, y así la prueba no depende del `.env.local` de cada máquina.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Habitacion, Pension } from "@/types";

const PLATAFORMA = "573009998888";
process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = PLATAFORMA;

const {
  WHATSAPP_NUMERO,
  enlaceWhatsApp,
  formatearCOP,
  etiquetaGenero,
  etiquetaTipo,
  numeroDeReserva,
  normalizarNumeroWhatsApp,
  numeroWhatsAppValido,
} = await import("@/lib/formato");

const PENSION: Pension = {
  id: "p1",
  slug: "pension-de-prueba",
  anfitrion_id: "u1",
  titulo: "Residencia Makia",
  descripcion: "Descripción de prueba para las pruebas unitarias.",
  precioMensual: 600000,
  direccion: "Calle 1 # 1-1",
  servicios: [],
  imagenes: [],
  activa: true,
  creada_en: new Date("2026-01-01T00:00:00Z"),
  barrio: "Mamatoco",
  distancia_a_pie_minutos: 8,
  normas: [],
  calificacion: 0,
  verificado: false,
  latitud: null,
  longitud: null,
};

/**
 * Un anuncio como los que quedaron de antes: con el número del dueño guardado.
 *
 * El molde es necesario porque `Pension` ya no declara ese campo. Lo que se
 * comprueba con él no es el tipo, sino el comportamiento: aunque el dato llegue,
 * el contacto sigue siendo de la plataforma.
 */
const comoHeredada = (whatsapp: string | null): Pension =>
  ({ ...PENSION, whatsapp }) as Pension;

const HABITACION: Habitacion = {
  id: "h1",
  pension_id: "p1",
  tipo: "individual",
  genero: "mixto",
  precio_mensual_cop: 600000,
  alimentacion_incluida: false,
  disponible: true,
};

describe("número de la plataforma", () => {
  it("se normaliza a solo dígitos al cargar el módulo", () => {
    assert.equal(WHATSAPP_NUMERO, PLATAFORMA);
    assert.equal(numeroWhatsAppValido(), true);
    assert.equal(normalizarNumeroWhatsApp("+57 300 999 8888"), "573009998888");
  });
});

describe("numeroDeReserva · siempre la plataforma", () => {
  it("devuelve el número de la plataforma", () => {
    assert.equal(numeroDeReserva(), PLATAFORMA);
  });

  it("no usa el número del dueño aunque el anuncio lo traiga guardado", () => {
    const enlace = enlaceWhatsApp(comoHeredada("3001234567"));
    assert.ok(enlace.startsWith(`https://wa.me/${PLATAFORMA}?text=`));
    assert.ok(!enlace.includes("3001234567"));
  });
});

describe("enlaceWhatsApp", () => {
  it("apunta a la plataforma y lleva el mensaje codificado", () => {
    const enlace = enlaceWhatsApp(PENSION, HABITACION);
    assert.ok(enlace.startsWith(`https://wa.me/${PLATAFORMA}?text=`));

    const mensaje = decodeURIComponent(enlace.split("?text=")[1] ?? "");
    assert.ok(mensaje.includes("Residencia Makia"));
    assert.ok(mensaje.includes("Individual"));
    assert.ok(mensaje.includes("Mixto"));
    assert.ok(mensaje.includes(formatearCOP(600000)));
    assert.ok(mensaje.includes("sin alimentación"));
  });

  it("incluye el barrio cuando el anuncio lo tiene", () => {
    const enlace = enlaceWhatsApp(PENSION, HABITACION);
    assert.ok(decodeURIComponent(enlace).includes("(Mamatoco)"));
  });

  it("con alimentación incluida lo dice en el mensaje (el estudiante necesita saberlo)", () => {
    const enlace = enlaceWhatsApp(PENSION, { ...HABITACION, alimentacion_incluida: true });
    assert.ok(decodeURIComponent(enlace).includes("con alimentación incluida"));
  });

  it("sin habitación (publicación heredada) usa el mensaje general con su precio de referencia", () => {
    const enlace = enlaceWhatsApp(PENSION);
    const mensaje = decodeURIComponent(enlace.split("?text=")[1] ?? "");
    assert.ok(mensaje.includes("me interesa el alquiler"));
    assert.ok(mensaje.includes(formatearCOP(600000)));
  });

  it("ni el enlace ni el mensaje dejan rastro del número del dueño", () => {
    const enlace = enlaceWhatsApp(comoHeredada("3001234567"), HABITACION);
    const completo = decodeURIComponent(enlace);
    assert.ok(!completo.includes("3001234567"));
    assert.ok(!completo.includes("573001234567"));
  });
});

describe("presentación", () => {
  it("formatea el precio en COP", () => {
    assert.equal(formatearCOP(600000), "$600.000");
    assert.equal(formatearCOP(0), "$0");
  });

  it("etiquetas de tipo y género", () => {
    assert.equal(etiquetaTipo("compartida"), "Compartida");
    assert.equal(etiquetaGenero("femenino"), "Femenino");
  });
});
