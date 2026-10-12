/**
 * El WhatsApp privado del anfitrión (`lib/contacto-anfitrion.ts`, tarea #76).
 *
 * QUÉ DEFIENDE ESTA PRUEBA
 * ------------------------
 * Que la lectura del número privado sepa distinguir tres cosas que se parecen y
 * no son lo mismo:
 *
 *   · `sin-numero` — la tabla existe y este anfitrión no ha dejado su número;
 *   · `sin-tabla`  — la migración todavía no está aplicada;
 *   · `error`      — la consulta falló.
 *
 * Confundirlas es el error que ya costó una ronda en este proyecto (#67): con un
 * solo «vacío», el panel del maestro diría «este anfitrión no tiene número»
 * cuando lo cierto es que la base no respondió, y el maestro concluiría lo
 * contrario de lo que pasa.
 *
 * CÓMO SE PRUEBA, Y POR QUÉ ASÍ
 * -----------------------------
 * Se conduce la función **real** contra un lector sembrado que imita la cadena
 * de Supabase —`.from(t).select(c).eq(c, v).maybeSingle()` y `.in(c, ids)`—, en
 * lugar de comprobar el texto del archivo. La costura es la misma que usan
 * `resolverPensionConSesion()` y `obtenerCatalogo()`: el cliente se puede
 * inyectar solo para las pruebas, y ningún camino de la aplicación pasa ese
 * argumento.
 *
 * El espejo del patrón contra la migración se comprueba **leyendo el `.sql`**:
 * si alguien cambia una de las dos puertas y no la otra, esta prueba falla. Es
 * lo que impide que el formulario deje pasar algo que la base rechaza con un
 * `23514` opaco.
 *
 * NINGÚN NÚMERO REAL
 * ------------------
 * Los números que aparecen aquí (`3000000000`, `6055555555`) no son asignables:
 * son ceros y cincos. No hay ni un teléfono de verdad escrito en el repositorio,
 * ni se consulta la base para descubrir uno.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COLUMNAS_CONTACTO,
  PATRON_WHATSAPP,
  TABLA_CONTACTO,
  enlaceParaEscribirAlAnfitrion,
  esTablaAusente,
  leerContactoDelAnfitrion,
  leerContactosDeAnfitriones,
  normalizarNumeroDeAnfitrion,
  numeroDeAnfitrionValido,
} from "@/lib/contacto-anfitrion";
import { COLUMNAS_PENSION } from "@/lib/supabase/mapeo";

const N_CELULAR = "3000000000";
const N_FIJO = "6055555555";
const ANFITRION = "11111111-1111-1111-1111-111111111111";

/** Lo que el lector sembrado recibió, para poder afirmar sobre lo que se pidió. */
interface Recibido {
  tabla: string;
  proyeccion: string;
  valoresDeFiltro: unknown[];
}

/**
 * Un lector de Supabase en miniatura.
 *
 * Reproduce las dos formas de consulta que usa el módulo —`maybeSingle()` y el
 * `await` directo sobre `.in(...)`— y solo responde, falla o corta la conexión.
 * Guarda lo que recibió porque parte de lo que hay que demostrar no es el
 * resultado sino **qué se pidió**: que la proyección sea explícita y que los
 * identificadores viajen sin repetirse.
 */
function crearLector(opciones: {
  datos?: unknown;
  error?: { code?: string; message: string } | null;
  cortaLaConexion?: boolean;
}): { cliente: SupabaseClient; recibido: Recibido } {
  const recibido: Recibido = { tabla: "", proyeccion: "", valoresDeFiltro: [] };

  const respuesta = () =>
    opciones.cortaLaConexion
      ? Promise.reject(new Error("corte de red"))
      : Promise.resolve({ data: opciones.datos ?? null, error: opciones.error ?? null });

  const lector = {
    from(tabla: string) {
      recibido.tabla = tabla;

      // El objeto es su propio «thenable», como en `motivo-catalogo.prueba.ts`:
      // los dos callbacks se invocan, porque si solo se encadenara el de éxito el
      // rechazo quedaría sin manejar y la promesa exterior no se resolvería nunca.
      const consulta = {
        select: (proyeccion: string) => {
          recibido.proyeccion = proyeccion;
          return consulta;
        },
        eq: (_columna: string, valor: unknown) => {
          recibido.valoresDeFiltro = [valor];
          return consulta;
        },
        in: (_columna: string, valores: unknown[]) => {
          recibido.valoresDeFiltro = valores;
          return consulta;
        },
        maybeSingle: () => respuesta(),
        then: (
          resolvio: (valor: unknown) => unknown,
          rechazo: (motivo: unknown) => unknown
        ) => respuesta().then(resolvio, rechazo),
      };

      return consulta;
    },
  };

  return { cliente: lector as unknown as SupabaseClient, recibido };
}

/** Silencia `console.error` mientras se provoca la avería: el registro es correcto, la salida ilegible no. */
async function sinRuido<T>(accion: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await accion();
  } finally {
    console.error = original;
  }
}

describe("el formato del número (tarea #76)", () => {
  it("el patrón de la base y el del código son el mismo, leídos del .sql", () => {
    // Si esta prueba falla, una de las dos puertas miente. Es el espejo que pide
    // la migración, comprobado en vez de prometido.
    const sql = readFileSync(
      join(process.cwd(), "supabase", "oleada-15-contacto-anfitrion-privado.sql"),
      "utf8"
    );

    assert.ok(
      sql.includes(PATRON_WHATSAPP.source),
      `la restricción de la base debe usar exactamente ${PATRON_WHATSAPP.source}`
    );
  });

  it("normaliza el celular quitando todo lo que no sea dígito", () => {
    assert.equal(normalizarNumeroDeAnfitrion("300 000 0000"), N_CELULAR);
    assert.equal(normalizarNumeroDeAnfitrion("(300) 000-0000"), N_CELULAR);
  });

  it("quita el indicativo 57 cuando viene, porque la base no lo guarda", () => {
    assert.equal(normalizarNumeroDeAnfitrion("+57 300 000 0000"), N_CELULAR);
    assert.equal(normalizarNumeroDeAnfitrion("573000000000"), N_CELULAR);
  });

  it("acepta celular y fijo con indicativo, y rechaza lo demás", () => {
    assert.equal(numeroDeAnfitrionValido(N_CELULAR), true, "celular: 3 + 9 dígitos");
    assert.equal(numeroDeAnfitrionValido(N_FIJO), true, "fijo: 60 + 8 dígitos");
    assert.equal(numeroDeAnfitrionValido("1234567890"), false, "diez dígitos que no son de nadie");
    assert.equal(numeroDeAnfitrionValido("2000000000"), false, "empieza por 2");
    assert.equal(numeroDeAnfitrionValido("300000000"), false, "nueve dígitos");
    assert.equal(numeroDeAnfitrionValido(""), false, "vacío");
  });

  it("el mismo número, escrito de tres formas, se guarda igual", () => {
    // Es lo que hace que la restricción de la base no rechace algo que el
    // formulario enseñó a escribir.
    const formas = ["3000000000", "300 000 0000", "+57 300 000 0000"];
    const guardados = new Set(formas.map(normalizarNumeroDeAnfitrion));

    assert.equal(guardados.size, 1);
    assert.equal([...guardados][0], N_CELULAR);
  });
});

describe("la clasificación de la falta de la tabla", () => {
  it("reconoce las dos formas en que se dice «la tabla no existe»", () => {
    // PostgREST responde PGRST205; PostgreSQL responde 42P01. Se reconocen las
    // dos porque aparecen según dónde falle la consulta.
    assert.equal(esTablaAusente({ code: "PGRST205", message: "Could not find the table" }), true);
    assert.equal(esTablaAusente({ code: "42P01", message: 'relation "contacto_anfitrion" does not exist' }), true);
    assert.equal(
      esTablaAusente({ code: null, message: "Could not find the table 'public.contacto_anfitrion' in the schema cache" }),
      true,
      "el mensaje solo también basta"
    );
  });

  it("un fallo que NO es «falta la tabla» no se disfraza de falta de la tabla", () => {
    assert.equal(esTablaAusente({ code: "42501", message: "permission denied" }), false);
    assert.equal(esTablaAusente({ code: "23514", message: "violates check constraint" }), false);
    assert.equal(esTablaAusente(null), false);
    assert.equal(esTablaAusente(undefined), false);
  });
});

describe("el enlace para escribirle al anfitrión", () => {
  it("lleva el número con el indicativo del país", () => {
    assert.equal(enlaceParaEscribirAlAnfitrion(N_CELULAR), `https://wa.me/57${N_CELULAR}`);
  });

  it("con mensaje, lo codifica en lugar de pegarlo en crudo", () => {
    const enlace = enlaceParaEscribirAlAnfitrion(N_CELULAR, "¿Sigue disponible? (Nido)");
    assert.ok(enlace?.startsWith(`https://wa.me/57${N_CELULAR}?text=`));
    assert.equal(decodeURIComponent(enlace!.split("?text=")[1] ?? ""), "¿Sigue disponible? (Nido)");
    assert.ok(!enlace!.includes(" "), "un espacio suelto en una URL se rompe al copiarla");
  });

  it("con un número inválido devuelve null: un enlace roto es peor que ninguno", () => {
    // Si devolviera una URL a medio formar, el maestro creería haber contactado.
    assert.equal(enlaceParaEscribirAlAnfitrion("1234567890"), null);
    assert.equal(enlaceParaEscribirAlAnfitrion(""), null);
    assert.equal(enlaceParaEscribirAlAnfitrion("no es un número"), null);
  });
});

describe("la lectura del número de un anfitrión", () => {
  it("con fila devuelve el número y su fecha", async () => {
    const { cliente } = crearLector({
      datos: { anfitrion_id: ANFITRION, whatsapp: N_CELULAR, actualizado_en: "2026-10-12T00:00:00Z" },
    });

    const leido = await leerContactoDelAnfitrion(ANFITRION, cliente);

    assert.equal(leido.estado, "ok");
    assert.equal(leido.estado === "ok" && leido.whatsapp, N_CELULAR);
    assert.equal(leido.estado === "ok" && leido.actualizado_en?.toISOString(), "2026-10-12T00:00:00.000Z");
  });

  it("sin fila dice «sin-numero», que no es «sin tabla» ni «error»", async () => {
    const { cliente } = crearLector({ datos: null });
    assert.equal((await leerContactoDelAnfitrion(ANFITRION, cliente)).estado, "sin-numero");
  });

  it("si la migración no está aplicada dice «sin-tabla», y eso no es un error", async () => {
    const { cliente } = crearLector({
      error: { code: "PGRST205", message: "Could not find the table 'public.contacto_anfitrion' in the schema cache" },
    });

    assert.equal((await leerContactoDelAnfitrion(ANFITRION, cliente)).estado, "sin-tabla");
  });

  it("un fallo de permisos es «error», no «sin-tabla»: se puede cerrar por lo que no es", async () => {
    const { cliente } = crearLector({ error: { code: "42501", message: "permission denied for table" } });
    assert.equal((await leerContactoDelAnfitrion(ANFITRION, cliente)).estado, "error");
  });

  it("una conexión que se corta es «error», no «sin-tabla»", async () => {
    const { cliente } = crearLector({ cortaLaConexion: true });
    const leido = await sinRuido(() => leerContactoDelAnfitrion(ANFITRION, cliente));
    assert.equal(leido.estado, "error");
  });

  it("los tres estados son distinguibles entre sí", async () => {
    // Es la afirmación central de la prueba: si dos de ellos coincidieran, el
    // panel del maestro no podría decir la verdad.
    const conNumero = await leerContactoDelAnfitrion(ANFITRION, crearLector({ datos: { anfitrion_id: ANFITRION, whatsapp: N_CELULAR } }).cliente);
    const sinNumero = await leerContactoDelAnfitrion(ANFITRION, crearLector({ datos: null }).cliente);
    const sinTabla = await leerContactoDelAnfitrion(ANFITRION, crearLector({ error: { code: "PGRST205", message: "schema cache" } }).cliente);
    const roto = await sinRuido(() => leerContactoDelAnfitrion(ANFITRION, crearLector({ cortaLaConexion: true }).cliente));

    const estados = [conNumero.estado, sinNumero.estado, sinTabla.estado, roto.estado];
    assert.deepEqual(estados, ["ok", "sin-numero", "sin-tabla", "error"]);
    assert.equal(new Set(estados).size, 4);
  });

  it("pide la tabla privada y una proyección explícita, nunca el comodín", async () => {
    const { cliente, recibido } = crearLector({ datos: null });
    await leerContactoDelAnfitrion(ANFITRION, cliente);

    assert.equal(recibido.tabla, TABLA_CONTACTO);
    assert.equal(recibido.proyeccion, COLUMNAS_CONTACTO);
    assert.ok(!recibido.proyeccion.includes("*"), "un `select=*` traería cualquier columna futura");
    assert.deepEqual(recibido.valoresDeFiltro, [ANFITRION]);
  });
});

describe("la lectura de los números de varios anfitriones", () => {
  it("devuelve un mapa por anfitrión", async () => {
    const { cliente } = crearLector({
      datos: [
        { anfitrion_id: "a1", whatsapp: N_CELULAR },
        { anfitrion_id: "a2", whatsapp: N_FIJO },
      ],
    });

    const { contactos, motivo } = await leerContactosDeAnfitriones(["a1", "a2"], cliente);

    assert.equal(motivo, null);
    assert.equal(contactos.get("a1"), N_CELULAR);
    assert.equal(contactos.get("a2"), N_FIJO);
  });

  it("una sola consulta para muchos anuncios, sin identificadores repetidos", async () => {
    // Con veinte anuncios de cinco anfitriones, la consulta viaja con cinco
    // identificadores y no con veinte.
    const { cliente, recibido } = crearLector({ datos: [] });
    await leerContactosDeAnfitriones(["a1", "a1", "a2", "a1", "a2"], cliente);

    assert.deepEqual(recibido.valoresDeFiltro, ["a1", "a2"]);
  });

  it("sin identificadores no consulta la base", async () => {
    const { cliente, recibido } = crearLector({ datos: [] });
    const { contactos, motivo } = await leerContactosDeAnfitriones([], cliente);

    assert.equal(contactos.size, 0);
    assert.equal(motivo, null);
    assert.equal(recibido.tabla, "", "no debe haber pedido nada");
  });

  it("distingue el mapa vacío por falta de tabla del mapa vacío porque nadie dejó su número", async () => {
    const sinTabla = await leerContactosDeAnfitriones(["a1"], crearLector({ error: { code: "PGRST205", message: "schema cache" } }).cliente);
    const vacio = await leerContactosDeAnfitriones(["a1"], crearLector({ datos: [] }).cliente);

    assert.equal(sinTabla.motivo, "sin-tabla");
    assert.equal(vacio.motivo, null);
    assert.equal(sinTabla.contactos.size, vacio.contactos.size, "los dos mapas están vacíos: la diferencia no puede estar en el mapa");
    assert.notEqual(sinTabla.motivo, vacio.motivo, "el motivo es lo que los separa");
  });

  it("un corte de conexión no se declara «sin-tabla»", async () => {
    const { contacto, motivo } = await sinRuido(async () => {
      const r = await leerContactosDeAnfitriones(["a1"], crearLector({ cortaLaConexion: true }).cliente);
      return { contacto: r.contactos, motivo: r.motivo };
    });

    assert.equal(motivo, "error");
    assert.equal(contacto.size, 0);
  });
});

describe("la frontera con el catálogo público", () => {
  it("la proyección del catálogo no pide el número del anfitrión", () => {
    // Es la mitad estática del punto 3 de la petición: el número no viaja en el
    // HTML de la ficha porque no se pide. El guion `verificar:contacto-privado`
    // comprueba lo mismo contra la base y contra las páginas servidas.
    assert.ok(!COLUMNAS_PENSION.includes("whatsapp"));
    assert.ok(!COLUMNAS_PENSION.includes("*"));
  });

  it("el número no entra en el tipo del catálogo, que es lo que viaja al navegador", () => {
    // `Pension` se serializa en el HTML de la ficha. Si el número entrara al
    // tipo, se publicaría solo; esta prueba vigila esa puerta.
    const tipos = readFileSync(join(process.cwd(), "types", "index.ts"), "utf8");
    const bloque = tipos.slice(tipos.indexOf("export interface Pension"));

    assert.ok(!/^\s*whatsapp\s*[?:]/m.test(bloque), "`Pension` no debe declarar el WhatsApp privado");
  });
});
