/**
 * Reservar y liberar una habitación desde el panel del maestro (tarea #106).
 *
 * QUÉ SE MIDE AQUÍ, Y QUÉ NO
 * --------------------------
 * Tres cosas, en tres frentes distintos:
 *
 *   1. **El efecto en el catálogo, con las funciones reales.** Marcar una habitación
 *      como reservada no es más que dejarla en `disponible = false` —es lo que la
 *      función de la base hace, medido en la #114: `disponible=f, reservada=t,
 *      previo=t`—, así que se conduce el catálogo real (`habitacionesDisponibles`,
 *      `precioDesde`, `precioReservable`, `resumenHabitaciones`) sobre ese estado y
 *      se comprueba que la habitación sale de la oferta, que el precio «desde» se
 *      recalcula con las que quedan y que, al liberarla, todo vuelve exactamente al
 *      valor de partida.
 *   2. **Que los precios no se mueven.** `desgloseReserva` —20 % de depósito, 10 %
 *      de tarifa, 10 % de anticipo y 80 % de saldo— da los mismos importes antes y
 *      después de reservar. Este cambio es de disponibilidad, no de dinero, y esta
 *      comprobación es la que lo demuestra si algún día alguien lo mezcla.
 *   3. **Que la escritura va por la función de la base y no por un `update` del
 *      cliente**, leyendo el código de `app/actions/maestro.ts` sin comentarios.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA, DICHO SIN ADORNOS
 * -------------------------------------------------
 * **No llama a la base.** No hay sesión maestra en el entorno de pruebas y no se
 * inventa una. Lo que aquí se da por bueno —que `marcar_habitacion_reservada` deja
 * la habitación en `disponible = false` y devuelve la fecha, y que
 * `liberar_habitacion_reservada` la devuelve a su estado anterior— es lo que el
 * Arquitecto midió contra producción al cerrar la #114, con la cuenta maestra real
 * y revirtiendo por excepción. Esta prueba comprueba **qué hace el catálogo con ese
 * estado** y **que el código no tiene otra puerta de escritura**; no sustituye a
 * aquella medición ni pretende hacerlo.
 *
 * La otra mitad del contrato —que `anon` recibe `42501` en las dos funciones y que
 * `reservada_en` no es legible por ningún rol de cliente— se mide contra la API
 * pública, y el resultado va en el informe de la tarea, no aquí.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { COLUMNAS_HABITACION, COLUMNAS_PENSION } from "@/lib/supabase/mapeo";
import type { Habitacion, PensionConHabitaciones } from "@/types";

/**
 * El número de plataforma se inyecta antes de importar `lib/formato.ts`, que lo lee
 * al cargarse (misma precaución que `desglose-reserva.prueba.ts`).
 */
process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "573009998888";

const { desgloseReserva, habitacionesDisponibles, precioDesde, precioReservable, resumenHabitaciones } =
  await import("@/lib/pension");
const { formatearFechaReserva } = await import("@/lib/formato");

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Un archivo del repositorio, sin comentarios.
 *
 * No es cosmética: varias comprobaciones son del tipo «esto **no** aparece», y los
 * propios archivos explican en sus comentarios lo que no hacen —`app/actions/maestro.ts`
 * dice «no por un `update`» en el comentario que documenta la decisión—. Sin
 * quitarlos, la afirmación mediría la prosa en vez del código. Misma función que
 * `panel-maestro.prueba.ts`, con el mismo motivo.
 */
function sinComentarios(codigoFuente: string): string {
  let salida = "";
  let i = 0;
  let comilla: string | null = null;

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

    if (caracter === "'" || caracter === '"' || caracter === "`") {
      comilla = caracter;
      salida += caracter;
      i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "/") {
      while (i < codigoFuente.length && codigoFuente[i] !== "\n") i += 1;
      continue;
    }

    if (caracter === "/" && siguiente === "*") {
      i += 2;
      while (i < codigoFuente.length && !(codigoFuente[i] === "*" && codigoFuente[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }

    salida += caracter;
    i += 1;
  }

  return salida;
}

function fuente(...ruta: string[]): string {
  return sinComentarios(readFileSync(join(RAIZ, ...ruta), "utf8"));
}

/**
 * El cuerpo de una Server Action, desde su `export async function` hasta la
 * siguiente. Sirve para afirmar cosas de **una** acción y no del archivo entero.
 */
function cuerpoDeLaAccion(archivo: string, nombre: string): string {
  const desde = archivo.indexOf(`export async function ${nombre}`);
  assert.ok(desde >= 0, `no se encontró la acción ${nombre}`);

  const resto = archivo.slice(desde);
  const siguiente = resto.indexOf("export async function", 10);
  return siguiente === -1 ? resto : resto.slice(0, siguiente);
}

const ACCIONES = fuente("app", "actions", "maestro.ts");

/* ------------------------------------------------------------------------- *
 * 1. El efecto en el catálogo
 * ------------------------------------------------------------------------- */

/** Una habitación del anuncio de prueba. */
function habitacion(parcial: Partial<Habitacion> & { id: string }): Habitacion {
  return {
    pension_id: "p1",
    tipo: "individual",
    genero: "mixto",
    precio_mensual_cop: 500000,
    alimentacion_incluida: false,
    disponible: true,
    ...parcial,
  };
}

/**
 * El anuncio de partida: dos habitaciones libres, la barata es la de 480.000.
 *
 * Es a propósito el más barato el que se reserva: así el precio «desde» tiene que
 * cambiar (#106), y una prueba que reservara la más cara pasaría sin medir nada.
 */
function anuncioDePartida(): PensionConHabitaciones {
  return {
    id: "p1",
    slug: "pension-de-prueba",
    codigo_visible: "NID-0001",
    anfitrion_id: "u1",
    titulo: "Pensión de prueba",
    descripcion: "Descripción de prueba para la prueba de la reserva.",
    precioMensual: 480000,
    direccion: "Calle 1 # 1-1",
    servicios: [],
    imagenes: [],
    activa: true,
    creada_en: new Date("2026-01-05T12:00:00Z"),
    barrio: "Villa Marbella",
    distancia_a_pie_minutos: 10,
    normas: [],
    calificacion: 4.6,
    verificado: true,
    verificado_en: null,
    habitaciones: [
      habitacion({ id: "h-barata", precio_mensual_cop: 480000 }),
      habitacion({ id: "h-cara", precio_mensual_cop: 900000, tipo: "compartida" }),
    ],
  };
}

/** El estado que deja `marcar_habitacion_reservada` (medido en la #114). */
function reservada(anuncio: PensionConHabitaciones, id: string): PensionConHabitaciones {
  return {
    ...anuncio,
    habitaciones: anuncio.habitaciones.map((h) => (h.id === id ? { ...h, disponible: false } : h)),
  };
}

/** El estado que deja `liberar_habitacion_reservada` (medido en la #114). */
function liberada(anuncio: PensionConHabitaciones, id: string): PensionConHabitaciones {
  return {
    ...anuncio,
    habitaciones: anuncio.habitaciones.map((h) => (h.id === id ? { ...h, disponible: true } : h)),
  };
}

describe("reservar una habitación · deja de ofrecerse", () => {
  it("la habitación reservada sale de `habitacionesDisponibles`", () => {
    const antes = anuncioDePartida();
    const despues = reservada(antes, "h-barata");

    assert.deepEqual(
      habitacionesDisponibles(antes).map((h) => h.id),
      ["h-barata", "h-cara"]
    );
    assert.deepEqual(
      habitacionesDisponibles(despues).map((h) => h.id),
      ["h-cara"],
      "una habitación reservada no puede seguir en la oferta"
    );
  });

  it("el precio «desde» se recalcula con las que quedan libres", () => {
    const despues = reservada(anuncioDePartida(), "h-barata");

    assert.equal(precioDesde(anuncioDePartida()), 480000);
    assert.equal(precioDesde(despues), 900000, "la tarjeta no puede seguir anunciando 480.000");
  });

  it("el precio reservable deja de ser el de la habitación reservada", () => {
    assert.equal(precioReservable(anuncioDePartida()), 480000);
    assert.equal(precioReservable(reservada(anuncioDePartida(), "h-barata")), 900000);
  });

  it("con todas reservadas, no hay precio reservable ni se ofrece reservar", () => {
    const sinLibres = reservada(reservada(anuncioDePartida(), "h-barata"), "h-cara");

    assert.equal(habitacionesDisponibles(sinLibres).length, 0);
    assert.equal(
      precioReservable(sinLibres),
      null,
      "el `precio_mensual` que conserva la base no es una oferta: no se anuncia como reservable"
    );
    assert.equal(resumenHabitaciones(sinLibres), "Sin habitaciones libres ahora");
  });
});

describe("liberar una habitación · vuelve exactamente a como estaba", () => {
  it("devuelve la habitación a la oferta", () => {
    const antes = anuncioDePartida();
    const ida = liberada(reservada(antes, "h-barata"), "h-barata");

    assert.deepEqual(
      habitacionesDisponibles(ida).map((h) => h.id),
      ["h-barata", "h-cara"]
    );
    assert.equal(precioDesde(ida), precioDesde(antes));
    assert.equal(precioReservable(ida), precioReservable(antes));
    assert.equal(resumenHabitaciones(ida), resumenHabitaciones(antes));
  });

  it("deja las habitaciones idénticas, no «parecidas»", () => {
    const antes = anuncioDePartida();
    const ida = liberada(reservada(antes, "h-barata"), "h-barata");

    assert.deepEqual(ida.habitaciones, antes.habitaciones);
  });
});

/* ------------------------------------------------------------------------- *
 * 2. Los precios no se mueven
 * ------------------------------------------------------------------------- */

describe("reservar y liberar · el desglose de precio no cambia", () => {
  /**
   * El desglose de la ficha se calcula con el precio de la habitación **elegida**,
   * no con el estado del anuncio (`components/DetallePension.tsx:59-64`). Por eso un
   * cambio de disponibilidad no puede moverlo, y esta prueba lo fija: si alguien
   * ligara el desglose a `precioDesde`, el importe del estudiante cambiaría al
   * reservar otra habitación, que es justo lo que no puede pasar.
   */
  it("el desglose de la habitación elegida es el mismo antes y después", () => {
    const antes = desgloseReserva(480000);
    const despues = desgloseReserva(
      reservada(anuncioDePartida(), "h-cara").habitaciones.find((h) => h.id === "h-barata")!
        .precio_mensual_cop
    );

    assert.deepEqual(despues, antes);
    assert.deepEqual(antes, {
      canon: 480000,
      deposito: 96000,
      tarifaServicio: 48000,
      anticipo: 48000,
      saldoAlLlegar: 384000,
    });
  });

  it("reservar la barata no toca el importe de la que sigue libre", () => {
    const anuncio = reservada(anuncioDePartida(), "h-barata");
    const cara = anuncio.habitaciones.find((h) => h.id === "h-cara")!;

    assert.deepEqual(desgloseReserva(cara.precio_mensual_cop), desgloseReserva(900000));
    assert.equal(desgloseReserva(cara.precio_mensual_cop).deposito, 180000);
  });
});

/* ------------------------------------------------------------------------- *
 * 3. La escritura va por la función de la base
 * ------------------------------------------------------------------------- */

describe("la escritura · solo por las dos funciones de la base", () => {
  it("las dos acciones llaman a las funciones por su nombre y con su argumento", () => {
    const marcar = cuerpoDeLaAccion(ACCIONES, "marcarHabitacionReservadaMaestro");
    const liberar = cuerpoDeLaAccion(ACCIONES, "liberarHabitacionReservadaMaestro");

    assert.ok(
      marcar.includes('rpc("marcar_habitacion_reservada"'),
      "marcar tiene que ir por la función de la base"
    );
    assert.ok(marcar.includes("p_habitacion_id"), "el argumento se llama `p_habitacion_id`");

    assert.ok(
      liberar.includes('rpc("liberar_habitacion_reservada"'),
      "liberar tiene que ir por la función de la base"
    );
    assert.ok(liberar.includes("p_habitacion_id"));
  });

  it("ninguna de las dos escribe en la tabla a mano", () => {
    for (const nombre of ["marcarHabitacionReservadaMaestro", "liberarHabitacionReservadaMaestro"]) {
      const cuerpo = cuerpoDeLaAccion(ACCIONES, nombre);

      assert.equal(
        /\.update\(/.test(cuerpo),
        false,
        `${nombre}: un \`update\` desde el cliente recibiría 42501 en reservada_en, y si pasara dejaría la reserva sin fecha ni autor`
      );
      assert.equal(
        /\.from\(\s*"habitaciones"\s*\)/.test(cuerpo),
        false,
        `${nombre}: la tabla no se toca desde aquí, ni para leer`
      );
      assert.equal(
        /reservada_en\s*:/.test(cuerpo),
        false,
        `${nombre}: la fecha la sella la base; enviarla desde el navegador sería inventarla`
      );
    }
  });

  it("las dos exigen sesión y perfil maestro antes de llamar", () => {
    for (const nombre of ["marcarHabitacionReservadaMaestro", "liberarHabitacionReservadaMaestro"]) {
      const cuerpo = cuerpoDeLaAccion(ACCIONES, nombre);
      assert.ok(cuerpo.includes("exigirMaestro()"), `${nombre} tiene que preguntar el rol a la base`);
    }
  });

  it("un `false` de liberar no se cuenta como éxito", () => {
    const liberar = cuerpoDeLaAccion(ACCIONES, "liberarHabitacionReservadaMaestro");

    assert.ok(
      /data !== true/.test(liberar),
      "la función devuelve `false` cuando no había reserva: responder «liberada» sería mentir"
    );
  });

  it("sin fecha devuelta, marcar no confirma la reserva", () => {
    const marcar = cuerpoDeLaAccion(ACCIONES, "marcarHabitacionReservadaMaestro");

    assert.ok(
      /if \(!reservadaEn\)/.test(marcar),
      "sin la fecha de la base no se puede afirmar que la reserva se guardó"
    );
  });
});

/* ------------------------------------------------------------------------- *
 * 4. La lectura no se contamina
 * ------------------------------------------------------------------------- */

describe("la lectura pública · las columnas nuevas siguen fuera", () => {
  /**
   * `reservada_en`, `reservada_por` y `disponible_antes_de_reservar` no tienen
   * `SELECT` para `anon` ni para `authenticated`: las dos reciben `42501`. Pedirlas
   * —o pedir `*`, que se expande a las once columnas— rompe la consulta entera. Con
   * el comodín, el catálogo dejaría de leerse.
   */
  const TODAS_LAS_COLUMNAS = COLUMNAS_HABITACION.split(",").map((c) => c.trim());

  for (const columna of ["reservada_en", "reservada_por", "disponible_antes_de_reservar"]) {
    it(`\`COLUMNAS_HABITACION\` no pide \`${columna}\` (daría 42501)`, () => {
      assert.equal(TODAS_LAS_COLUMNAS.includes(columna), false);
    });
  }

  it("ni `COLUMNAS_HABITACION` ni `COLUMNAS_PENSION` usan el comodín", () => {
    for (const [nombre, valor] of [
      ["COLUMNAS_HABITACION", COLUMNAS_HABITACION],
      ["COLUMNAS_PENSION", COLUMNAS_PENSION],
    ] as const) {
      assert.equal(valor.includes("*"), false, `${nombre} no puede llevar «*»: se expande a las tres columnas nuevas`);
    }
  });

  it("el proyecto no pide `select(\"*\")` en ninguna parte", () => {
    const archivos = [
      ["lib", "datos.ts"],
      ["lib", "supabase", "mapeo.ts"],
      ["app", "actions", "maestro.ts"],
    ] as const;

    for (const ruta of archivos) {
      assert.equal(
        /select\(\s*"\*"\s*\)/.test(fuente(...ruta)),
        false,
        `${ruta.join("/")}: \`select("*")\` sobre habitaciones responde 42501 desde la oleada 17`
      );
    }
  });
});

/* ------------------------------------------------------------------------- *
 * 5. La fecha de la reserva
 * ------------------------------------------------------------------------- */

describe("formatearFechaReserva · la fecha que devuelve la base", () => {
  it("la escribe en la zona de Santa Marta, no en la del servidor", () => {
    // 02:30 UTC del 22 es todavía el 21 en Bogotá (UTC−5). En Vercel, que corre en
    // UTC, formatear con la zona del servidor mostraría el día equivocado.
    const texto = formatearFechaReserva("2026-10-22T02:30:00Z");

    assert.ok(texto, "una fecha ISO válida tiene que formatearse");
    assert.ok(
      texto.startsWith("21 de octubre de 2026"),
      `se esperaba el 21 en Bogotá y se obtuvo «${texto}»`
    );
    assert.match(texto, /9:30/, "la hora también se muestra, en formato de 12 horas");
  });

  it("acepta un `Date` y también una cadena ISO", () => {
    assert.equal(
      formatearFechaReserva(new Date("2026-10-21T15:41:00Z")),
      formatearFechaReserva("2026-10-21T15:41:00Z")
    );
  });

  it("sin fecha devuelve `null`, que es lo que el panel sabe dibujar", () => {
    for (const valor of [null, undefined, "", "   ", "no es una fecha", 1698000000000, {}]) {
      assert.equal(formatearFechaReserva(valor), null, `«${String(valor)}» no es una fecha`);
    }
  });
});

/* ------------------------------------------------------------------------- *
 * 6. La interfaz
 * ------------------------------------------------------------------------- */

describe("el panel · dos botones y la fecha cuando se conoce", () => {
  const PANEL = fuente("components", "PanelMaestro.tsx");

  it("cada habitación tiene «Marcar reservada» y «Liberar»", () => {
    assert.ok(PANEL.includes('"Marcar reservada"'));
    assert.ok(PANEL.includes('"Liberar"'));
  });

  it("el formulario de la habitación ya no envía `disponible`", () => {
    assert.equal(
      /name="disponible"/.test(PANEL),
      false,
      "el estado reservada no se escribe con un booleano: lo decide la función de la base"
    );
  });

  it("la antigua acción de disponibilidad no se usa desde el panel", () => {
    assert.equal(
      /cambiarDisponibilidadMaestro/.test(PANEL),
      false,
      "quedó reemplazada por las dos funciones de reserva"
    );
  });

  it("enseña la fecha de la reserva cuando la base la devolvió", () => {
    assert.ok(PANEL.includes("formatearFechaReserva"));
    assert.ok(PANEL.includes("Reservada el"));
  });

  it("dibuja el estado con el vocabulario de la #107", () => {
    assert.ok(PANEL.includes('"Libre"'));
    assert.ok(PANEL.includes('"Reservada"'));
    assert.equal(/"Ocupada"/.test(PANEL), false, "«ocupada» se retiró en la #107");
  });
});

describe("la ficha pública · sin vocabulario nuevo para el estudiante", () => {
  const FICHA = fuente("components", "DetallePension.tsx");

  it("sigue partiendo por `disponible`, así que la reservada cae donde caen las demás", () => {
    assert.ok(/const disponibles = pension\.habitaciones\.filter\(\(h\) => h\.disponible\)/.test(FICHA));
    assert.ok(/const agotadas = pension\.habitaciones\.filter\(\(h\) => !h\.disponible\)/.test(FICHA));
  });

  it("no anuncia «reservada» al estudiante: usa el bloque que ya existía", () => {
    assert.equal(
      /reservad[ao]/i.test(FICHA),
      false,
      "la ficha no distingue una reserva de un huésped viviendo: la base no lo dice y el texto no puede inventarlo"
    );
    assert.ok(FICHA.includes("No disponibles por ahora"));
  });
});
