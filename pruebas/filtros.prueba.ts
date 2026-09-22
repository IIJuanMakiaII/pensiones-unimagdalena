/**
 * Motor de filtrado (`lib/filtros.ts`).
 *
 * Es el corazón del producto: decide qué anuncios ve un estudiante. Incluye la
 * regla corregida en la tarea #15 —un anuncio con todas las habitaciones
 * ocupadas no puede satisfacer una búsqueda por precio—, que antes solo se
 * comprobaba contra la base de datos y la web servida.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PASO_PRECIO,
  PRECIO_MAX_DEFECTO,
  PRECIO_MIN_DEFECTO,
  aplicarFiltros,
  coincideRangoDistancia,
  filtrosAParametros,
  habitacionCumpleFiltros,
  habitacionDestacada,
  limitesDePrecio,
  parametrosAFiltros,
  pensionCumpleFiltros,
  type FiltrosUI,
} from "@/lib/filtros";
import type { Habitacion, Pension, PensionConHabitaciones } from "@/types";

const MAXIMO_REAL = 1000000;

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

function filtros(extra: Partial<FiltrosUI> = {}): FiltrosUI {
  return {
    precioMaximoCop: 0,
    genero: "todos",
    rangoDistancia: "cualquiera",
    soloConAlimentacion: false,
    soloVerificadas: false,
    soloFavoritas: false,
    ...extra,
  };
}

describe("pensionCumpleFiltros · anuncio con habitaciones pero todas ocupadas", () => {
  const ocupado = pension({
    precioMensual: 1000, // precio conservado por la base (podría venir de una edición)
    habitaciones: [habitacion({ disponible: false })],
  });

  it("NO pasa el filtro cuando el estudiante puso un tope de precio", () => {
    // Es la regla de la tarea #15: sin nada reservable no puede competir por precio.
    assert.equal(
      pensionCumpleFiltros(ocupado, filtros({ precioMaximoCop: 300000 }), MAXIMO_REAL),
      false
    );
  });

  it("SÍ sigue visible cuando no hay tope de precio (la tarjeta avisa de que no hay libres)", () => {
    assert.equal(pensionCumpleFiltros(ocupado, filtros({ precioMaximoCop: 0 }), MAXIMO_REAL), true);
    assert.equal(
      pensionCumpleFiltros(ocupado, filtros({ precioMaximoCop: MAXIMO_REAL }), MAXIMO_REAL),
      true
    );
  });

  it("NO pasa los filtros de género ni de alimentación: los satisface una habitación concreta", () => {
    assert.equal(
      pensionCumpleFiltros(ocupado, filtros({ genero: "femenino" }), MAXIMO_REAL),
      false
    );
    assert.equal(
      pensionCumpleFiltros(ocupado, filtros({ soloConAlimentacion: true }), MAXIMO_REAL),
      false
    );
  });
});

describe("pensionCumpleFiltros · anuncio sin habitaciones publicadas (heredado)", () => {
  const heredado = pension({ precioMensual: 500000 });

  it("usa su precio declarado solo si cabe en el tope", () => {
    assert.equal(
      pensionCumpleFiltros(heredado, filtros({ precioMaximoCop: 300000 }), MAXIMO_REAL),
      false
    );
    assert.equal(
      pensionCumpleFiltros(heredado, filtros({ precioMaximoCop: 600000 }), MAXIMO_REAL),
      true
    );
    assert.equal(pensionCumpleFiltros(heredado, filtros({ precioMaximoCop: 0 }), MAXIMO_REAL), true);
  });
});

describe("pensionCumpleFiltros · con habitaciones libres", () => {
  const casa = pension({
    habitaciones: [
      habitacion({ id: "h1", precio_mensual_cop: 250000 }),
      habitacion({ id: "h2", precio_mensual_cop: 100000, disponible: false }),
    ],
  });

  it("pasa si la habitación LIBRE cabe en el tope (la ocupada no cuenta)", () => {
    assert.equal(
      pensionCumpleFiltros(casa, filtros({ precioMaximoCop: 300000 }), MAXIMO_REAL),
      true
    );
    assert.equal(
      pensionCumpleFiltros(casa, filtros({ precioMaximoCop: 200000 }), MAXIMO_REAL),
      false
    );
  });

  it("respeta género, alimentación y verificación", () => {
    assert.equal(pensionCumpleFiltros(casa, filtros({ genero: "femenino" }), MAXIMO_REAL), false);
    assert.equal(
      pensionCumpleFiltros(casa, filtros({ soloVerificadas: true }), MAXIMO_REAL),
      false
    );
    assert.equal(
      pensionCumpleFiltros(casa, filtros({ genero: "mixto", soloConAlimentacion: false }), MAXIMO_REAL),
      true
    );
  });

  it("la verificación se exige solo cuando el filtro está activo", () => {
    const verificada = pension({ verificado: true, habitaciones: [habitacion()] });
    assert.equal(pensionCumpleFiltros(verificada, filtros({ soloVerificadas: true }), MAXIMO_REAL), true);
  });
});

describe("coincideRangoDistancia · límites exactos", () => {
  it("«<5» excluye los 5 minutos (son el inicio del tramo siguiente)", () => {
    assert.equal(coincideRangoDistancia(4, "<5"), true);
    assert.equal(coincideRangoDistancia(5, "<5"), false);
  });

  it("«5-10» incluye ambos extremos", () => {
    assert.equal(coincideRangoDistancia(5, "5-10"), true);
    assert.equal(coincideRangoDistancia(10, "5-10"), true);
    assert.equal(coincideRangoDistancia(11, "5-10"), false);
  });

  it("«10-15» empieza justo después de 10", () => {
    assert.equal(coincideRangoDistancia(10, "10-15"), false);
    assert.equal(coincideRangoDistancia(11, "10-15"), true);
    assert.equal(coincideRangoDistancia(15, "10-15"), true);
    assert.equal(coincideRangoDistancia(16, "10-15"), false);
  });

  it("«cualquiera» no filtra nada", () => {
    assert.equal(coincideRangoDistancia(120, "cualquiera"), true);
    assert.equal(pensionCumpleFiltros(pension({ distancia_a_pie_minutos: 120 }), filtros(), MAXIMO_REAL), true);
  });
});

describe("limitesDePrecio · rango del deslizador", () => {
  it("el precio conservado de un anuncio ocupado NO ensancha el rango", () => {
    const catalogo = [
      pension({ id: "a", precioMensual: 1000, habitaciones: [habitacion({ disponible: false })] }),
      pension({ id: "b", habitaciones: [habitacion({ precio_mensual_cop: 400000 })] }),
      pension({ id: "c", precioMensual: 900000 }),
    ];
    assert.deepEqual(limitesDePrecio(catalogo), { min: 400000, max: 900000 });
  });

  it("sin ningún precio utilizable devuelve el rango por defecto", () => {
    const catalogo = [
      pension({ id: "a", habitaciones: [habitacion({ disponible: false })] }),
      pension({ id: "b", precioMensual: 0 }),
    ];
    assert.deepEqual(limitesDePrecio(catalogo), {
      min: PRECIO_MIN_DEFECTO,
      max: PRECIO_MAX_DEFECTO,
    });
  });

  it("si todos los precios coinciden abre un tramo para que el control siga siendo usable", () => {
    const catalogo = [pension({ id: "a", habitaciones: [habitacion({ precio_mensual_cop: 400000 })] })];
    assert.deepEqual(limitesDePrecio(catalogo), { min: 400000, max: 400000 + PASO_PRECIO });
  });
});

describe("habitacionCumpleFiltros y habitacionDestacada", () => {
  it("una habitación ocupada nunca cumple", () => {
    assert.equal(habitacionCumpleFiltros(habitacion({ disponible: false }), filtros()), false);
  });

  it("la destacada es la más barata que cumple los filtros activos", () => {
    const p = pension({
      habitaciones: [
        habitacion({ id: "h1", precio_mensual_cop: 480000 }),
        habitacion({ id: "h2", precio_mensual_cop: 320000 }),
        habitacion({ id: "h3", precio_mensual_cop: 250000, disponible: false }),
      ],
    });
    assert.equal(habitacionDestacada(p, filtros())?.id, "h2");
    assert.equal(habitacionDestacada(p, filtros({ precioMaximoCop: 400000 }))?.id, "h2");
    assert.equal(habitacionDestacada(p, filtros({ precioMaximoCop: 300000 })), null);
  });
});

describe("aplicarFiltros", () => {
  const catalogo = [
    pension({ id: "lejos", distancia_a_pie_minutos: 20, habitaciones: [habitacion({ pension_id: "lejos" })] }),
    pension({ id: "cerca", distancia_a_pie_minutos: 4, habitaciones: [habitacion({ pension_id: "cerca" })] }),
    pension({ id: "medio", distancia_a_pie_minutos: 9, habitaciones: [habitacion({ pension_id: "medio" })] }),
  ];

  it("ordena por distancia a pie (lo más cercano primero)", () => {
    const resultado = aplicarFiltros(catalogo, filtros(), MAXIMO_REAL);
    assert.deepEqual(
      resultado.map((p) => p.id),
      ["cerca", "medio", "lejos"]
    );
  });

  it("el filtro por rango de distancia deja fuera lo que no encaja", () => {
    const resultado = aplicarFiltros(catalogo, filtros({ rangoDistancia: "<5" }), MAXIMO_REAL);
    assert.deepEqual(
      resultado.map((p) => p.id),
      ["cerca"]
    );
  });

  it("los favoritos solo filtran cuando el filtro está activo (viven en el navegador)", () => {
    assert.deepEqual(
      aplicarFiltros(catalogo, filtros({ soloFavoritas: true }), MAXIMO_REAL, ["medio"]).map((p) => p.id),
      ["medio"]
    );
    assert.equal(aplicarFiltros(catalogo, filtros(), MAXIMO_REAL, ["medio"]).length, 3);
  });
});

describe("filtros en la URL", () => {
  it("ida y vuelta conserva exactamente los filtros activos", () => {
    const original = filtros({
      precioMaximoCop: 400000,
      genero: "femenino",
      rangoDistancia: "5-10",
      soloConAlimentacion: true,
      soloVerificadas: true,
      soloFavoritas: true,
    });
    const parametros = filtrosAParametros(original, MAXIMO_REAL);
    assert.deepEqual(parametrosAFiltros(parametros, MAXIMO_REAL), original);
  });

  it("no escribe en la URL los filtros por defecto", () => {
    assert.equal(filtrosAParametros(filtros({ precioMaximoCop: MAXIMO_REAL }), MAXIMO_REAL).toString(), "");
  });

  it("ignora valores inválidos en lugar de romper el catálogo", () => {
    const sucios = new URLSearchParams({
      genero: "inventado",
      dist: "999",
      precio: "no-es-un-numero",
    });
    assert.deepEqual(parametrosAFiltros(sucios, MAXIMO_REAL), filtros({ precioMaximoCop: MAXIMO_REAL }));
  });

  it("recorta un tope de precio mayor que el catálogo real", () => {
    const parametros = new URLSearchParams({ precio: "99999999" });
    assert.equal(parametrosAFiltros(parametros, MAXIMO_REAL).precioMaximoCop, MAXIMO_REAL);
  });
});
