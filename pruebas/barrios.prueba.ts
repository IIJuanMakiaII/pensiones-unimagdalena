/**
 * Agrupación de publicaciones por barrio (`lib/barrios.ts`).
 *
 * Se prueba aquí, y no contra la base de datos, porque lo que puede fallar es la
 * lógica, no los datos: el barrio lo escribe el anfitrión a mano, así que la
 * normalización es la que decide si dos publicaciones acaban en la misma página
 * o en dos. Un fallo ahí no revienta nada — simplemente duplica páginas y reparte
 * el contenido, que es el modo de fallo silencioso de esta función.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resumenesDeBarrio, slugDeBarrio } from "@/lib/barrios";
import type { Habitacion, PensionConHabitaciones } from "@/types";

function habitacion(cambios: Partial<Habitacion> = {}): Habitacion {
  return {
    id: "h-1",
    pension_id: "p-1",
    tipo: "individual",
    genero: "mixto",
    precio_mensual_cop: 500000,
    alimentacion_incluida: false,
    disponible: true,
    ...cambios,
  };
}

function pension(cambios: Partial<PensionConHabitaciones> = {}): PensionConHabitaciones {
  return {
    id: "p-1",
    slug: "pension-uno",
    anfitrion_id: "a-1",
    titulo: "Pensión Uno",
    descripcion: "Descripción de prueba con longitud suficiente.",
    precioMensual: 500000,
    direccion: "Calle 1",
    servicios: [],
    imagenes: [],
    activa: true,
    creada_en: new Date("2026-01-01"),
    barrio: "El Pando",
    distancia_a_pie_minutos: 10,
    normas: [],
    calificacion: 4.5,
    verificado: true,
    habitaciones: [habitacion()],
    ...cambios,
  } as PensionConHabitaciones;
}

describe("slugDeBarrio", () => {
  it("pasa a minúsculas y separa con guiones", () => {
    assert.equal(slugDeBarrio("El Pando"), "el-pando");
    assert.equal(slugDeBarrio("Los Troncos"), "los-troncos");
  });

  it("quita las tildes para que la dirección sea tecleable", () => {
    assert.equal(slugDeBarrio("Ciénaga"), "cienaga");
  });

  it("ignora mayúsculas y espacios sobrantes: el mismo barrio da la misma dirección", () => {
    assert.equal(slugDeBarrio("  el   pando "), slugDeBarrio("El Pando"));
  });

  it("no deja guiones al principio ni al final", () => {
    assert.equal(slugDeBarrio("-- El Pando --"), "el-pando");
  });

  it("devuelve cadena vacía cuando no queda nada utilizable", () => {
    assert.equal(slugDeBarrio("   "), "");
    assert.equal(slugDeBarrio("¿?"), "");
  });
});

describe("resumenesDeBarrio", () => {
  it("agrupa bajo la misma página los barrios escritos distinto", () => {
    const resumenes = resumenesDeBarrio([
      pension({ id: "p-1", barrio: "El Pando" }),
      pension({ id: "p-2", barrio: "el pando", slug: "pension-dos" }),
    ]);

    assert.equal(resumenes.length, 1);
    assert.equal(resumenes[0].pensiones.length, 2);
  });

  it("descarta las publicaciones retiradas y las que no tienen barrio", () => {
    const resumenes = resumenesDeBarrio([
      pension({ id: "p-1", activa: false }),
      pension({ id: "p-2", barrio: "   " }),
      pension({ id: "p-3", barrio: "Gaira" }),
    ]);

    assert.equal(resumenes.length, 1);
    assert.equal(resumenes[0].barrio, "Gaira");
  });

  it("calcula el rango de precio con lo que se puede reservar, no con el precio de referencia", () => {
    const resumenes = resumenesDeBarrio([
      pension({ id: "p-1", habitaciones: [habitacion({ precio_mensual_cop: 400000 })] }),
      pension({ id: "p-2", habitaciones: [habitacion({ precio_mensual_cop: 900000 })] }),
    ]);

    assert.equal(resumenes[0].precioMinimo, 400000);
    assert.equal(resumenes[0].precioMaximo, 900000);
  });

  it("deja el rango en nulo si todas las habitaciones están ocupadas", () => {
    const resumenes = resumenesDeBarrio([
      pension({ habitaciones: [habitacion({ disponible: false })] }),
    ]);

    assert.equal(resumenes[0].precioMinimo, null);
    assert.equal(resumenes[0].precioMaximo, null);
  });

  it("toma la distancia menor declarada en el barrio", () => {
    const resumenes = resumenesDeBarrio([
      pension({ id: "p-1", distancia_a_pie_minutos: 15 }),
      pension({ id: "p-2", distancia_a_pie_minutos: 6 }),
    ]);

    assert.equal(resumenes[0].minutosMinimos, 6);
  });

  it("cuenta cada servicio una vez por publicación, aunque esté repetido", () => {
    const resumenes = resumenesDeBarrio([
      pension({ id: "p-1", servicios: ["WiFi", "WiFi", "Agua"] }),
      pension({ id: "p-2", servicios: ["WiFi"] }),
    ]);

    const porNombre = new Map(resumenes[0].servicios.map((s) => [s.nombre, s.veces]));
    assert.equal(porNombre.get("WiFi"), 2);
    assert.equal(porNombre.get("Agua"), 1);
  });

  it("ordena los barrios por número de publicaciones", () => {
    const resumenes = resumenesDeBarrio([
      pension({ id: "p-1", barrio: "Gaira" }),
      pension({ id: "p-2", barrio: "El Pando" }),
      pension({ id: "p-3", barrio: "El Pando" }),
    ]);

    assert.equal(resumenes[0].barrio, "El Pando");
    assert.equal(resumenes[1].barrio, "Gaira");
  });

  it("devuelve lista vacía cuando no hay publicaciones: de ahí sale el 404", () => {
    assert.deepEqual(resumenesDeBarrio([]), []);
  });
});
