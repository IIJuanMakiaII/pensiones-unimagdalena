/**
 * Tarea #122 — El panel del anfitrión: tres estados y liberar la propia reserva.
 *
 * QUÉ SE MIDE AQUÍ
 * ---------------
 *   1. **La tabla de estados**, ejecutada de verdad: `libre` / `reservada` /
 *      `apagada`, incluidos los casos raros (cadena vacía, `undefined`, una fila
 *      incoherente con `disponible = true` y reserva).
 *   2. **La puerta de propiedad**, también ejecutada: es la función que decide si
 *      una habitación es de las publicaciones de esta cuenta. Su tabla de casos es
 *      donde vive el riesgo —listas vacías, `null`, `undefined`— y aquí queda
 *      escrita con el resultado esperado.
 *   3. **El orden de la acción en el servidor**, leído del código: primero la
 *      identidad de la sesión, después la pensión de la habitación, después la
 *      comparación, y **solo entonces** la llamada a
 *      `liberar_habitacion_reservada`. Y que liberar no escriba la columna.
 *
 * LO QUE ESTA PRUEBA NO DEMUESTRA
 * ------------------------------
 * **No llama a la base.** No hay sesión de anfitrión en el entorno de pruebas y no
 * se inventa ninguna. Que `liberar_habitacion_reservada` acepte al dueño y rechace
 * al ajeno con `42501` es lo que midió el Líder contra producción con dos
 * anfitriones sintéticos, y que un anfitrión ajeno recibe 0 filas en los `UPDATE`
 * directos, también. Aquí se comprueba que **el código va por donde tiene que ir**:
 * por la función para liberar, por la columna solo para encender y apagar, y con la
 * comprobación de propiedad delante.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `lib/formato.ts` lee el número de plataforma al cargarse; se inyecta antes de
 * importar nada que lo arrastre.
 */
process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "573009998888";

const { estadoDeLaHabitacion } = await import("@/lib/reserva");
const { esHabitacionDeMisPensiones } = await import("@/lib/pension-escritura");

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Un archivo del repositorio sin comentarios (misma utilidad que las demás pruebas). */
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

/** El cuerpo de una acción, desde su `export async function` hasta la siguiente. */
function cuerpoDeLaAccion(archivo: string, nombre: string): string {
  const desde = archivo.indexOf(`export async function ${nombre}`);
  assert.ok(desde >= 0, `no se encontró la acción ${nombre}`);

  const resto = archivo.slice(desde + 10);
  const siguiente = resto.indexOf("export async function");
  return siguiente === -1 ? resto : resto.slice(0, siguiente);
}

const PANEL = fuente("components", "PanelPublicacion.tsx");
const EDITOR_HABITACIONES = fuente("components", "EditorHabitaciones.tsx");
const ACCIONES = fuente("app", "actions", "pensiones.ts");
const PAGINA_PUBLICAR = fuente("app", "publicar", "page.tsx");

const LIBERAR = cuerpoDeLaAccion(ACCIONES, "liberarReservaDeMiHabitacion");
const DISPONIBILIDAD = cuerpoDeLaAccion(ACCIONES, "cambiarDisponibilidadHabitacion");

/* ------------------------------------------------------------------------- *
 * 1. Los tres estados
 * ------------------------------------------------------------------------- */

describe("una habitación tiene tres estados, no dos", () => {
  const FECHA = "2026-10-21T14:29:35.214665+00:00";

  it("se ofrece en el catálogo: libre", () => {
    assert.equal(estadoDeLaHabitacion(true, null), "libre");
    assert.equal(estadoDeLaHabitacion(true, undefined), "libre");
    assert.equal(estadoDeLaHabitacion(true, ""), "libre");
  });

  it("tiene reserva registrada: reservada", () => {
    assert.equal(estadoDeLaHabitacion(false, FECHA), "reservada");
  });

  it("la apagó el anfitrión: apagada, y no se la llama reservada", () => {
    // Es el caso que la tarea #122 vino a separar. Antes caía en el mismo saco que
    // «reservada» y el panel no ofrecía volver a ofrecerla.
    assert.equal(estadoDeLaHabitacion(false, null), "apagada");
    assert.equal(estadoDeLaHabitacion(false, undefined), "apagada");
    assert.equal(estadoDeLaHabitacion(false, ""), "apagada");
  });

  it("una fila incoherente no se convierte en reserva inventada", () => {
    // `disponible = true` con reserva no debería existir: la restricción
    // `habitaciones_reservada_no_se_ofrece` lo impide. Si llegara, manda la columna,
    // que es lo que el catálogo está enseñando en ese instante.
    assert.equal(estadoDeLaHabitacion(true, FECHA), "libre");
  });
});

/* ------------------------------------------------------------------------- *
 * 2. La puerta de propiedad
 * ------------------------------------------------------------------------- */

describe("una habitación solo es mía si su pensión está entre mis publicaciones", () => {
  it("la pensión propia pasa", () => {
    assert.equal(esHabitacionDeMisPensiones(["p1", "p2"], "p2"), true);
  });

  it("la pensión de otro anfitrión no pasa", () => {
    assert.equal(esHabitacionDeMisPensiones(["p1", "p2"], "p3"), false);
  });

  it("sin publicaciones no hay habitación propia", () => {
    // Una lista vacía no vuelve propia a nada: es el caso de una cuenta nueva o de
    // una lectura que no devolvió nada.
    assert.equal(esHabitacionDeMisPensiones([], "p1"), false);
  });

  it("una pensión ausente o vacía no pasa", () => {
    assert.equal(esHabitacionDeMisPensiones(["p1"], null), false);
    assert.equal(esHabitacionDeMisPensiones(["p1"], undefined), false);
    assert.equal(esHabitacionDeMisPensiones(["p1"], ""), false);
  });

  it("no hay coincidencias por prefijo ni por subcadena", () => {
    // `includes` sobre un array compara el elemento entero: una pensión cuyo id
    // contuviera el de otra no se colaría.
    assert.equal(esHabitacionDeMisPensiones(["p1"], "p10"), false);
    assert.equal(esHabitacionDeMisPensiones(["p10"], "p1"), false);
  });
});

/* ------------------------------------------------------------------------- *
 * 3. La acción que libera: orden, puerta y función
 * ------------------------------------------------------------------------- */

describe("liberar la reserva propia pasa por la función, y solo después de comprobar", () => {
  it("la identidad sale de la sesión, no del formulario", () => {
    assert.match(LIBERAR, /supabase\.auth\.getUser\(\)/);
    assert.ok(
      !/formData\.get\(\s*"(anfitrion|usuario|userId|anfitrionId)"/i.test(LIBERAR),
      "el formulario no puede decir de quién es la habitación"
    );
  });

  it("exige el correo confirmado, como las demás escrituras del panel", () => {
    assert.match(LIBERAR, /user\.email_confirmed_at/);
  });

  it("comprueba la propiedad ANTES de llamar a la función", () => {
    const mios = LIBERAR.indexOf('.eq("anfitrion_id", user.id)');
    const pensionDeLaHabitacion = LIBERAR.indexOf('select("id, pension_id")');
    const comparacion = LIBERAR.indexOf("esHabitacionDeMisPensiones(");
    const llamada = LIBERAR.indexOf('.rpc("liberar_habitacion_reservada"');

    assert.ok(mios >= 0, "no se leen las publicaciones de la sesión");
    assert.ok(pensionDeLaHabitacion >= 0, "no se lee la pensión de la habitación");
    assert.ok(comparacion >= 0, "no se compara la pensión con las propias");
    assert.ok(llamada >= 0, "no se llama a la función de la base");

    assert.ok(
      mios < pensionDeLaHabitacion && pensionDeLaHabitacion < comparacion && comparacion < llamada,
      `el orden tiene que ser publicaciones → pensión → comparación → función, y es ${mios}, ${pensionDeLaHabitacion}, ${comparacion}, ${llamada}`
    );
  });

  it("la comparación tiene su propio retorno: no se sigue si no es tuya", () => {
    // Sin un `if` que devuelva, la comparación sería decorativa. El `if` está
    // ANTES de la llamada a la comparación (`if (!esHabitacionDeMisPensiones(…)`),
    // así que el bloque arranca en el `if`, no en el nombre de la función.
    const comparacion = LIBERAR.indexOf("esHabitacionDeMisPensiones(");
    const abreElIf = LIBERAR.lastIndexOf("if (", comparacion);

    assert.ok(
      abreElIf >= 0 && abreElIf < comparacion,
      "la comprobación de propiedad no está dentro de un `if`"
    );

    const bloque = LIBERAR.slice(
      abreElIf,
      LIBERAR.indexOf('.rpc("liberar_habitacion_reservada"')
    );

    assert.match(bloque, /if\s*\(/);
    assert.match(bloque, /!\s*esHabitacionDeMisPensiones\(/, "tiene que negar la pertenencia");
    assert.match(bloque, /return\s*\{/);
  });

  it("nunca escribe la columna: liberar es cosa de la función", () => {
    assert.ok(
      !LIBERAR.includes(".update("),
      "liberar una reserva no puede ir por un update de `disponible`"
    );
    // Y se nombran las columnas: `select("*")` sobre `habitaciones` da 42501.
    assert.ok(!LIBERAR.includes('select("*")'), "nada de select(*) sobre habitaciones");
  });

  it("el identificador va como argumento de la función, con su nombre", () => {
    assert.match(LIBERAR, /p_habitacion_id:\s*habitacionId/);
  });

  it("un `false` de la función no se cuenta como éxito", () => {
    // `false` significa «no había nada que liberar», y la función no toca
    // `disponible`. Responder «liberada» sería decir que se hizo algo que no ocurrió.
    assert.match(LIBERAR, /data !== true/);
  });

  it("el panel se refresca: la acción invalida /publicar", () => {
    assert.match(ACCIONES, /function revalidarPanelAnfitrion/);
    assert.match(ACCIONES, /revalidatePath\("\/publicar", "page"\)/);
    assert.match(LIBERAR, /revalidarPanelAnfitrion\(\)/);
  });
});

/* ------------------------------------------------------------------------- *
 * 4. La acción que enciende y apaga
 * ------------------------------------------------------------------------- */

describe("encender y apagar una habitación sin reserva sigue siendo la columna", () => {
  it("escribe `disponible` por el predicado de propiedad, como antes", () => {
    assert.match(DISPONIBILIDAD, /\.update\(\{ disponible \}\)/);
    assert.match(DISPONIBILIDAD, /\.in\("pension_id", misPensionesIds\)/);
    assert.match(DISPONIBILIDAD, /\.eq\("id", habitacionId\)/);
  });

  it("no reserva: las funciones de reserva no se llaman desde aquí", () => {
    assert.ok(!DISPONIBILIDAD.includes("marcar_habitacion_reservada"));
    assert.ok(!DISPONIBILIDAD.includes("liberar_habitacion_reservada"));
  });

  it("apagar ya no se cuenta como reservar", () => {
    // El mensaje antiguo decía «marcada como reservada» y esa frase fue la que hizo
    // creer que la columna bastaba para reservar.
    assert.ok(!/marcada como reservada/i.test(DISPONIBILIDAD));
    assert.match(DISPONIBILIDAD, /Habitación retirada de la oferta/);
    assert.match(DISPONIBILIDAD, /Habitación libre otra vez/);
  });
});

/* ------------------------------------------------------------------------- *
 * 5. La interfaz: tres etiquetas, dos formularios
 * ------------------------------------------------------------------------- */

describe("el panel enseña tres estados y ofrece la acción que cada uno admite", () => {
  it("los tres estados se dicen con palabras distintas", () => {
    assert.match(PANEL, /texto: "Libre"/);
    assert.match(PANEL, /texto: "Reservada"/);
    assert.match(PANEL, /texto: "No se ofrece"/);
  });

  it("las tres acciones existen, incluida la que faltaba", () => {
    assert.match(PANEL, /"Retirar de la oferta"/);
    assert.match(PANEL, /"Volver a ofrecer"/);
    assert.match(PANEL, /"Liberar reserva"/);
  });

  it("la rama de encender envía `disponible = 1`", () => {
    // Este es el botón que la #119 quitó y la #122 devuelve. Sin esta dirección, una
    // habitación apagada por mantenimiento no se podía volver a ofrecer.
    assert.match(PANEL, /value=\{situacion === "apagada" \? "1" : "0"\}/);
  });

  it("la rama reservada va por la función y no manda `disponible`", () => {
    const rama = PANEL.slice(
      PANEL.indexOf('situacion === "reservada" ?'),
      PANEL.indexOf(") : (", PANEL.indexOf('situacion === "reservada" ?'))
    );
    assert.match(rama, /action=\{accionLiberar\}/);
    assert.ok(
      !rama.includes('name="disponible"'),
      "liberar no escribe la columna: el formulario no debe llevar `disponible`"
    );
  });

  it("ningún texto dice «reservada» cuando no hay reserva", () => {
    // La frase exacta que la #119 dejó en su lugar, y que era mentira para una
    // habitación apagada.
    assert.ok(!PANEL.includes("Esta habitación está reservada"));
    // La única mención de «Reservada el …» está condicionada a que haya fecha.
    const conFecha = PANEL.indexOf("Reservada el {fecha}");
    assert.ok(conFecha >= 0, "el panel debe seguir mostrando la fecha de la reserva");
    const antes = PANEL.slice(Math.max(0, conFecha - 220), conFecha);
    assert.match(antes, /situacion === "reservada" && fecha/);
  });

  it("el estado se decide por la función y no por la columna sola", () => {
    assert.match(PANEL, /estadoDeLaHabitacion\(habitacion\.disponible, reservadaEn\)/);
  });

  it("el editor sigue igual: desactiva la casilla solo si hay reserva", () => {
    // La prop del editor se llama `reservadas`, no `reservas`: es la que monta
    // `FormularioEditarPension` y la que esta prueba no puede renombrar.
    assert.match(
      EDITOR_HABITACIONES,
      /disabled=\{Boolean\(habitacion\.id && reservadas\[habitacion\.id\]\)\}/
    );
  });

  it("la página lee las reservas por la función y las reparte por anuncio", () => {
    assert.match(PAGINA_PUBLICAR, /await leerReservas\(\)/);
    assert.match(PAGINA_PUBLICAR, /reservas=\{reservasDeLaPension\(/);
    assert.ok(!PAGINA_PUBLICAR.includes("reservada_en"), "la columna no se pide nunca");
  });
});
