/**
 * Número de WhatsApp de reserva (`lib/formato.ts`).
 *
 * Es el único canal de conversión del producto. La regla tiene dos partes que se
 * rompen con facilidad: el número propio del anfitrión (10 dígitos, con el 57
 * antepuesto al armar el enlace) y el respaldo a la plataforma para los anuncios
 * publicados antes de que existiera el campo.
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
  normalizarWhatsappPropio,
  numeroWhatsAppValido,
  whatsappPropioValido,
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
  whatsapp: null,
  latitud: null,
  longitud: null,
};

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

describe("normalizarWhatsappPropio · lo que el anfitrión escribe", () => {
  it("acepta los formatos en que se pega un número real", () => {
    assert.equal(normalizarWhatsappPropio("+57 300 123 4567"), "3001234567");
    assert.equal(normalizarWhatsappPropio("300-123-4567"), "3001234567");
    assert.equal(normalizarWhatsappPropio("(300) 123 4567"), "3001234567");
    assert.equal(normalizarWhatsappPropio("300 123 4567"), "3001234567");
  });

  it("retira el código de país cuando viene incluido (12 dígitos empezando por 57)", () => {
    assert.equal(normalizarWhatsappPropio("573001234567"), "3001234567");
    assert.equal(normalizarWhatsappPropio("+57 300 123 4567"), "3001234567");
  });

  it("no confunde un número que empieza por 57 y ya es de 10 dígitos", () => {
    assert.equal(normalizarWhatsappPropio("573001234"), "573001234");
  });
});

describe("whatsappPropioValido · exactamente 10 dígitos", () => {
  it("acepta 10 y rechaza cualquier otra cosa", () => {
    assert.equal(whatsappPropioValido("3001234567"), true);
    assert.equal(whatsappPropioValido("300123456"), false);
    assert.equal(whatsappPropioValido("30012345678"), false);
    assert.equal(whatsappPropioValido("300123456a"), false);
    assert.equal(whatsappPropioValido(""), false);
  });
});

describe("numeroDeReserva · a quién le llega la reserva", () => {
  it("usa el número propio con el 57 antepuesto (el estudiante puede estar fuera del país)", () => {
    assert.equal(numeroDeReserva({ ...PENSION, whatsapp: "3001234567" }), "573001234567");
    assert.equal(numeroDeReserva({ ...PENSION, whatsapp: "+57 300 123 4567" }), "573001234567");
  });

  it("cae al respaldo de la plataforma cuando el anuncio no tiene número propio", () => {
    assert.equal(numeroDeReserva({ ...PENSION, whatsapp: null }), PLATAFORMA);
    assert.equal(numeroDeReserva({ ...PENSION }), PLATAFORMA);
    assert.equal(numeroDeReserva({ ...PENSION, whatsapp: "" }), PLATAFORMA);
  });

  it("cae al respaldo si el número propio guardado no es válido (nunca deja el botón roto)", () => {
    assert.equal(numeroDeReserva({ ...PENSION, whatsapp: "300 123" }), PLATAFORMA);
    assert.equal(numeroDeReserva({ ...PENSION, whatsapp: "1234567890123" }), PLATAFORMA);
  });
});

describe("enlaceWhatsApp", () => {
  it("apunta al número del dueño y lleva el mensaje codificado", () => {
    const enlace = enlaceWhatsApp({ ...PENSION, whatsapp: "3001234567" }, HABITACION);
    assert.ok(enlace.startsWith("https://wa.me/573001234567?text="));

    const mensaje = decodeURIComponent(enlace.split("?text=")[1] ?? "");
    assert.ok(mensaje.includes("Residencia Makia"));
    assert.ok(mensaje.includes("Individual"));
    assert.ok(mensaje.includes("Mixto"));
    assert.ok(mensaje.includes(formatearCOP(600000)));
    assert.ok(mensaje.includes("sin alimentación"));
  });

  it("incluye el barrio cuando el anuncio lo tiene", () => {
    const enlace = enlaceWhatsApp({ ...PENSION, whatsapp: "3001234567" }, HABITACION);
    assert.ok(decodeURIComponent(enlace).includes("(Mamatoco)"));
  });

  it("con alimentación incluida lo dice en el mensaje (el estudiante necesita saberlo)", () => {
    const enlace = enlaceWhatsApp(
      { ...PENSION, whatsapp: "3001234567" },
      { ...HABITACION, alimentacion_incluida: true }
    );
    assert.ok(decodeURIComponent(enlace).includes("con alimentación incluida"));
  });

  it("sin habitación (publicación heredada) usa el mensaje general con su precio de referencia", () => {
    const enlace = enlaceWhatsApp({ ...PENSION, whatsapp: "3001234567" });
    const mensaje = decodeURIComponent(enlace.split("?text=")[1] ?? "");
    assert.ok(mensaje.includes("me interesa el alquiler"));
    assert.ok(mensaje.includes(formatearCOP(600000)));
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
