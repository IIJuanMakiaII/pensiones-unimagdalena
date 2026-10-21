/**
 * Los dos huecos que cerró la tarea #119.
 *
 * QUÉ SE MIDE, EN UNA FRASE POR HUECO
 * ----------------------------------
 *   1. **La fecha persistida.** Que el panel se entere de qué está reservado por
 *      `public.listar_reservas()` —la función de la oleada 18— y no leyendo la
 *      columna, que sigue cerrada para `authenticated`. Y que el recorte por
 *      anuncio no invente fechas ni preste a una tarjeta las de otra.
 *   2. **El fallo claro.** Que un `23514` por reserva y un `23514` por longitud no
 *      se cuenten con la misma frase, y que la interfaz deje de ofrecer el botón
 *      que la base rechaza sin tocar el caso no reservado.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA
 * ------------------------------
 * **No llama a la base.** No hay sesión maestra ni de anfitrión en el entorno de
 * pruebas y no se inventa ninguna. Que `listar_reservas()` existe, que devuelve
 * `[{ habitacion_id, reservada_en }]` y que `anon` no puede ejecutarla es lo que se
 * midió contra producción al aplicar la oleada 18; aquí se comprueba que **el
 * código va por ahí** y no por la columna. Lo que sí se ejecuta de verdad son las
 * funciones puras: el recorte por anuncio y la traducción del error.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `lib/formato.ts` lee el número de plataforma al cargarse; se inyecta antes de
 * importar nada que lo arrastre (misma precaución que `reserva-habitacion.prueba.ts`).
 */
process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "573009998888";

const { reservasDeLaPension } = await import("@/lib/reserva");
const { mensajeDeErrorDeBase } = await import("@/lib/pension-escritura");
const { COLUMNAS_HABITACION } = await import("@/lib/supabase/mapeo");

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Un archivo del repositorio tal cual. */
function leer(...ruta: string[]): string {
  return readFileSync(join(RAIZ, ...ruta), "utf8");
}

/**
 * Un archivo del repositorio sin comentarios.
 *
 * Las comprobaciones del tipo «esto no aparece» medirían la prosa si los
 * comentarios siguieran ahí: estos archivos explican por escrito justo lo que **no**
 * hacen. Misma función que `reserva-habitacion.prueba.ts`, por el mismo motivo.
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
  return sinComentarios(leer(...ruta));
}

const LECTOR = fuente("lib", "reservas.ts");
const MODULO_NEUTRO = fuente("lib", "reserva.ts");
const PANEL_MAESTRO = fuente("components", "PanelMaestro.tsx");
const PANEL_ANFITRION = fuente("components", "PanelPublicacion.tsx");
const EDITOR_HABITACIONES = fuente("components", "EditorHabitaciones.tsx");
const PAGINA_MAESTRO = fuente("app", "maestro", "page.tsx");
const PAGINA_EDITAR_ANFITRION = fuente("app", "publicar", "[id]", "editar", "page.tsx");
const PAGINA_EDITAR_MAESTRO = fuente("app", "maestro", "[id]", "editar", "page.tsx");
const ACCIONES_ANFITRION = fuente("app", "actions", "pensiones.ts");

/* ------------------------------------------------------------------------- *
 * 1. La fecha se lee por la función, no por la columna
 * ------------------------------------------------------------------------- */

describe("la fecha de reserva se lee por la función de la #118", () => {
  it("el lector llama a `listar_reservas` sin argumentos", () => {
    assert.match(LECTOR, /\.rpc\(\s*"listar_reservas"\s*\)/);
  });

  it("el lector no toca la tabla `habitaciones` ni pide la columna", () => {
    // La columna sigue cerrada para `authenticated`: pedirla da `42501` en toda la
    // lectura, y añadirla a `COLUMNAS_HABITACION` rompería el catálogo entero.
    assert.ok(!LECTOR.includes('.from("habitaciones")'), "el lector no debe consultar `habitaciones`");
    assert.ok(!LECTOR.includes(".from('habitaciones')"), "el lector no debe consultar `habitaciones`");
    assert.ok(!/select\s*\(/.test(LECTOR), "el lector no debe hacer ningún `select`");
  });

  it("`reservada_en` sigue fuera de las columnas que viajan al cliente", () => {
    // `COLUMNAS_HABITACION` es la lista con la que se pide la tabla, así que basta
    // con que ninguna de las tres columnas de la reserva aparezca en ella: pedirlas
    // deja la lectura entera en `42501` desde la oleada 17.
    for (const columna of ["reservada_en", "reservada_por", "disponible_antes_de_reservar"]) {
      assert.ok(
        !COLUMNAS_HABITACION.includes(columna),
        `${columna} no puede estar en COLUMNAS_HABITACION: daría 42501 en toda la lectura`
      );
    }
  });

  it("el panel del maestro pide las reservas y las pasa a la tarjeta", () => {
    assert.match(PAGINA_MAESTRO, /await leerReservas\(\)/);
    assert.match(PAGINA_MAESTRO, /reservasDeLaPension\(/);
    assert.match(PAGINA_MAESTRO, /reservas=\{reservasDeLaPension\(/);
  });

  it("la fecha persistida llega a la fila y se pinta al recargar", () => {
    // La prop existe y se pasa por habitación…
    assert.match(PANEL_MAESTRO, /reservas:\s*ReservasPorHabitacion/);
    assert.match(PANEL_MAESTRO, /reservadaEn=\{reservas\[habitacion\.id\] \?\? null\}/);
    // …y el texto usa las dos fuentes: la recién marcada y la persistida.
    assert.match(PANEL_MAESTRO, /formatearFechaReserva\(estadoReservar\.reservadaEn\)/);
    assert.match(PANEL_MAESTRO, /formatearFechaReserva\(reservadaEn\)/);
    assert.match(PANEL_MAESTRO, /Reservada el \{fechaDeEstaReserva\}/);
  });

  it("las dos pantallas de edición leen por la función, nunca por la columna", () => {
    for (const [nombre, archivo] of [
      ["/publicar/[id]/editar", PAGINA_EDITAR_ANFITRION],
      ["/maestro/[id]/editar", PAGINA_EDITAR_MAESTRO],
    ] as const) {
      assert.match(archivo, /await leerReservas\(\)/, `${nombre} no lee las reservas`);
      assert.ok(
        !archivo.includes("reservada_en"),
        `${nombre} no puede pedir la columna: daría 42501`
      );
    }
  });

  it("el recorte por anuncio entrega solo lo suyo y no inventa fechas", () => {
    const mapa = {
      "h-1": "2026-10-21T14:29:35.214665+00:00",
      "h-2": "2026-10-20T09:00:00.000000+00:00",
    };

    assert.deepEqual(reservasDeLaPension(mapa, ["h-1"]), {
      "h-1": "2026-10-21T14:29:35.214665+00:00",
    });

    // Una habitación sin reserva no aparece, en vez de aparecer con algo.
    assert.deepEqual(reservasDeLaPension(mapa, ["h-1", "h-sin-reserva"]), {
      "h-1": "2026-10-21T14:29:35.214665+00:00",
    });

    // Sin habitaciones no hay nada que contar, y sin reservas tampoco.
    assert.deepEqual(reservasDeLaPension(mapa, []), {});
    assert.deepEqual(reservasDeLaPension({}, ["h-1", "h-2"]), {});

    // Los dos recortes no se pisan: recortar una vez no altera el mapa de origen.
    assert.deepEqual(Object.keys(mapa).sort(), ["h-1", "h-2"]);
  });
});

/* ------------------------------------------------------------------------- *
 * 2. El rechazo por reserva se cuenta distinto que una longitud
 * ------------------------------------------------------------------------- */

/**
 * El texto real que devuelve PostgreSQL al chocar con la restricción de la oleada
 * 17, según lo midió el Arquitecto al aplicarla. Se reproduce aquí en vez de
 * inventarse una forma: es lo que hace que la comprobación signifique algo.
 */
const ERROR_DE_RESERVA = {
  code: "23514",
  message:
    'new row for relation "habitaciones" violates check constraint "habitaciones_reservada_no_se_ofrece"',
};

const ERROR_DE_LONGITUD = {
  code: "23514",
  message: 'new row for relation "pensiones" violates check constraint "pensiones_titulo_largo"',
};

describe("un `23514` por reserva no se cuenta como un `23514` por longitud", () => {
  it("la reserva se explica como reserva y no habla del título", () => {
    const mensaje = mensajeDeErrorDeBase(ERROR_DE_RESERVA);

    assert.match(mensaje, /reservada/i);
    assert.ok(
      !/longitudes/i.test(mensaje) && !/título/i.test(mensaje),
      `el aviso de reserva no puede acusar al título: «${mensaje}»`
    );
    // Dice qué hacer, no solo que algo falló.
    assert.match(mensaje, /coordinación/i);
  });

  it("una longitud de más sigue hablando de longitudes", () => {
    const mensaje = mensajeDeErrorDeBase(ERROR_DE_LONGITUD);

    assert.match(mensaje, /longitudes/i);
    assert.ok(!/reservada/i.test(mensaje), `una longitud no es una reserva: «${mensaje}»`);
  });

  it("`42501` y los códigos desconocidos conservan su texto de siempre", () => {
    assert.match(mensajeDeErrorDeBase({ code: "42501", message: "permission denied" }), /sello/i);
    assert.match(mensajeDeErrorDeBase({ code: "08006", message: "connection" }), /Vuelve a intentarlo/);
    // Y un `23514` cuyo texto no menciona la restricción no se disfraza de reserva.
    assert.match(mensajeDeErrorDeBase({ code: "23514", message: "violates check constraint" }), /longitudes/i);
  });

  it("la acción del anfitrión traduce por ese mismo módulo, no con un texto suelto", () => {
    // Segunda capa: la interfaz ya no ofrece el botón, pero un envío a mano sigue
    // llegando aquí, y responder «vuelve a intentarlo» invitaría a repetirlo.
    const desde = ACCIONES_ANFITRION.indexOf(
      "export async function cambiarDisponibilidadHabitacion"
    );
    assert.ok(desde >= 0, "no se encontró la acción de disponibilidad");

    // Solo el cuerpo de esta acción: la siguiente empieza en el `export` que viene
    // después, y su texto de error no tiene nada que ver con esta comprobación.
    const resto = ACCIONES_ANFITRION.slice(desde + 10);
    const siguiente = resto.indexOf("export async function");
    const cuerpo = siguiente === -1 ? resto : resto.slice(0, siguiente);
    assert.match(cuerpo, /mensajeDeErrorDeBase\(error\)/);
    assert.ok(
      !cuerpo.includes("No pudimos guardar el cambio. Vuelve a intentarlo en unos segundos."),
      "el rechazo por reserva no puede seguir respondiendo «vuelve a intentarlo»"
    );
  });
});

/* ------------------------------------------------------------------------- *
 * 3. El editor no ofrece la acción que la base rechazará
 *
 * El panel del anfitrión cambió después, en la tarea #122: pasó de dos estados a
 * tres y recuperó las acciones que le faltaban. Su contrato se prueba en
 * `reserva-anfitrion-122.prueba.ts`; lo que queda aquí es lo que la #119 fijó y
 * sigue valiendo, que es el editor y su mensaje.
 * ------------------------------------------------------------------------- */

describe("el editor no ofrece la acción que la base rechazará", () => {
  it("el panel del anfitrión ya no deduce el estado de la columna sola", () => {
    // Este era el defecto de la #119: la etiqueta se calculaba con
    // `!habitacion.disponible`, que mete en el mismo saco «reservada» y «apagada».
    assert.ok(
      !PANEL_ANFITRION.includes("siguienteDisponible"),
      "ya no hay «siguiente estado» calculado solo con la columna"
    );
    assert.match(PANEL_ANFITRION, /estadoDeLaHabitacion\(/);
  });

  it("el editor no deja marcar «Disponible ahora» en una habitación reservada", () => {
    assert.match(
      EDITOR_HABITACIONES,
      /disabled=\{Boolean\(habitacion\.id && reservadas\[habitacion\.id\]\)\}/
    );
    assert.match(EDITOR_HABITACIONES, /Está reservada: la reserva no se libera desde el editor/);
    // La prop es opcional y su defecto es «ninguna reserva»: el formulario de alta
    // —donde ninguna habitación tiene `id` todavía— no cambia de comportamiento.
    assert.match(EDITOR_HABITACIONES, /reservadas = \{\}/);
  });

  it("el editor no gana ninguna escritura: `disponible` se sigue enviando igual", () => {
    assert.match(EDITOR_HABITACIONES, /actualizar\(indice, \{ disponible: evento\.target\.checked \}\)/);
    assert.ok(
      !EDITOR_HABITACIONES.includes("marcar_habitacion_reservada") &&
        !EDITOR_HABITACIONES.includes("liberar_habitacion_reservada"),
      "ningún componente de cliente puede llamar a las funciones de reserva"
    );
  });
});
