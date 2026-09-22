/**
 * Reglas de precio de una pensión (`lib/pension.ts`).
 *
 * Estas reglas se contradecían entre sí en dos ocasiones (un anuncio anunciaba un
 * precio que ya no se podía reservar). Antes solo se comprobaban con una prueba
 * extremo a extremo contra la base de datos; aquí quedan como unidad, que corre
 * siempre y sin credenciales.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  habitacionesDisponibles,
  precioDesde,
  precioReservable,
  resumenHabitaciones,
} from "@/lib/pension";
import type { Habitacion, Pension, PensionConHabitaciones } from "@/types";

const BASE: Pension = {
  id: "p1",
  slug: "pension-de-prueba",
  anfitrion_id: "u1",
  titulo: "Pensión de prueba",
  descripcion: "Descripción de prueba para las pruebas unitarias.",
  precioMensual: 500000,
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

function pension(extra: Partial<PensionConHabitaciones> = {}): PensionConHabitaciones {
  return { ...BASE, habitaciones: [], ...extra };
}

function habitacion(extra: Partial<Habitacion> = {}): Habitacion {
  return {
    id: "h1",
    pension_id: "p1",
    tipo: "individual",
    genero: "mixto",
    precio_mensual_cop: 500000,
    alimentacion_incluida: false,
    disponible: true,
    ...extra,
  };
}

describe("precioReservable", () => {
  it("devuelve la habitación libre más barata", () => {
    const p = pension({
      habitaciones: [
        habitacion({ id: "h1", precio_mensual_cop: 480000 }),
        habitacion({ id: "h2", precio_mensual_cop: 300000 }),
      ],
    });
    assert.equal(precioReservable(p), 300000);
  });

  it("ignora las habitaciones ocupadas aunque sean más baratas", () => {
    const p = pension({
      habitaciones: [
        habitacion({ id: "h1", precio_mensual_cop: 300000, disponible: false }),
        habitacion({ id: "h2", precio_mensual_cop: 480000, disponible: true }),
      ],
    });
    assert.equal(precioReservable(p), 480000);
  });

  it("devuelve null cuando todas están ocupadas (el precio conservado no es una oferta)", () => {
    const p = pension({
      precioMensual: 480000,
      habitaciones: [habitacion({ disponible: false })],
    });
    assert.equal(precioReservable(p), null);
  });

  it("devuelve null cuando no hay habitaciones publicadas", () => {
    assert.equal(precioReservable(pension()), null);
  });

  it("devuelve null si la única habitación libre vale 0 (no es un precio anunciable)", () => {
    const p = pension({ habitaciones: [habitacion({ precio_mensual_cop: 0 })] });
    assert.equal(precioReservable(p), null);
  });
});

describe("precioDesde", () => {
  it("usa el precio declarado si nunca se publicaron habitaciones", () => {
    assert.equal(precioDesde(pension({ precioMensual: 600000 })), 600000);
  });

  it("con habitaciones ocupadas devuelve el precio que conserva la base", () => {
    const p = pension({ precioMensual: 480000, habitaciones: [habitacion({ disponible: false })] });
    assert.equal(precioDesde(p), 480000);
  });

  it("con habitaciones libres devuelve la más barata", () => {
    const p = pension({
      precioMensual: 999999,
      habitaciones: [
        habitacion({ id: "h1", precio_mensual_cop: 700000 }),
        habitacion({ id: "h2", precio_mensual_cop: 450000 }),
      ],
    });
    assert.equal(precioDesde(p), 450000);
  });
});

describe("habitacionesDisponibles", () => {
  it("filtra solo las libres y tolera que falte el arreglo", () => {
    const p = pension({
      habitaciones: [
        habitacion({ id: "h1", disponible: true }),
        habitacion({ id: "h2", disponible: false }),
      ],
    });
    assert.deepEqual(
      habitacionesDisponibles(p).map((h) => h.id),
      ["h1"]
    );

    const sinArreglo = { ...BASE } as PensionConHabitaciones;
    assert.deepEqual(habitacionesDisponibles(sinArreglo), []);
  });
});

describe("resumenHabitaciones", () => {
  it("distingue «sin publicar» de «todas ocupadas»: son cosas distintas para el estudiante", () => {
    assert.equal(resumenHabitaciones(pension()), "Sin habitaciones publicadas todavía");
    assert.equal(
      resumenHabitaciones(pension({ habitaciones: [habitacion({ disponible: false })] })),
      "Sin habitaciones libres ahora"
    );
    assert.equal(
      resumenHabitaciones(pension({ habitaciones: [habitacion()] })),
      "1 habitación disponible"
    );
    assert.equal(
      resumenHabitaciones(
        pension({ habitaciones: [habitacion({ id: "h1" }), habitacion({ id: "h2" })] })
      ),
      "2 habitaciones disponibles"
    );
  });
});
