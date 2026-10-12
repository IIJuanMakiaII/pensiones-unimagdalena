/**
 * El guardado del WhatsApp privado (`lib/contacto-anfitrion.ts`, tarea #77).
 *
 * QUÉ DEFIENDE ESTA PRUEBA
 * ------------------------
 * `guardarContactoDelAnfitrion()` es la **única** función de todo el cambio que
 * **escribe** el dato sensible, y hasta ahora no tenía ninguna aserción detrás: sus
 * cinco estados no estaban ejercidos en ningún sitio. Eso dejaba uno de los criterios
 * de la ficha —«el número se guarda **solo** en `contacto_anfitrion`, y **no** en
 * `pensiones`»— sostenido únicamente por la lectura del código. «Bien por
 * construcción» no es una prueba.
 *
 * LO QUE **NO** SE PRUEBA AQUÍ, Y POR QUÉ
 * --------------------------------------
 * El camino vivo —`ok` contra la base real, y el panel del maestro con el número
 * verdadero— **no se simula**: exige que la migración esté aplicada, y un doble que
 * devolviera una fila inventada demostraría que el código sabe leer un objeto que yo
 * mismo acabo de escribir, no que el número llegue a guardarse. Eso se demuestra
 * cuando el propietario aplique `oleada-15-contacto-anfitrion-privado.sql`.
 *
 * CÓMO SE PRUEBA LO QUE SÍ SE PUEDE
 * ---------------------------------
 * Con un **doble de cliente inyectado**, que es la costura que el módulo ya expone
 * (`cliente?: SupabaseClient`) y la misma que usó la #76 para probar su clasificación.
 * El doble no solo responde: **guarda lo que recibió**, porque la mitad de lo que hay
 * que demostrar no es el resultado sino *qué se pidió* — a qué tabla, con qué columnas
 * y con qué identidad.
 *
 * NINGÚN NÚMERO REAL
 * ------------------
 * Los números de aquí (`3000000000`, `6055555555`) no son asignables: son ceros y
 * cincos. No hay ni un teléfono de verdad escrito en el repositorio.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { guardarContactoDelAnfitrion } from "@/lib/contacto-anfitrion";

const CELULAR = "3000000000";
const FIJO = "6055555555";
const ANFITRION = "11111111-1111-1111-1111-111111111111";
const OTRA_PERSONA = "22222222-2222-2222-2222-222222222222";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** El código de un archivo, sin comentarios: lo que decide es lo que ejecuta, no su prosa. */
function fuente(relativa: string): string {
  return readFileSync(join(RAIZ, ...relativa.split("/")), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Lo que el escritor sembrado recibió, para poder afirmar sobre lo que se pidió. */
interface Recibido {
  /** La tabla de la escritura. La aserción del criterio de aceptación vive aquí. */
  tabla: string;
  /** El registro exacto que se envió al `upsert`. */
  valores: Record<string, unknown> | null;
  /** El conflicto que se declaró resolver. */
  conflicto: string | null;
  /** La proyección que se pidió de vuelta. */
  proyeccion: string;
  /** Si se llegó a tocar la base. Con un número inválido, no debe tocarse. */
  tocoLaBase: boolean;
  /** Si se preguntó por la sesión. */
  pidioLaSesion: boolean;
}

/**
 * Un escritor de Supabase en miniatura.
 *
 * Reproduce la cadena que usa el módulo —`auth.getUser()` y
 * `.from(t).upsert(v, { onConflict }).select(c).maybeSingle()`— y solo escribe, falla
 * o corta la conexión.
 */
function crearEscritor(opciones: {
  usuario?: { id: string } | null;
  datos?: unknown;
  error?: { code?: string | null; message: string } | null;
  cortaLaConexion?: boolean;
}): { cliente: SupabaseClient; recibido: Recibido } {
  const recibido: Recibido = {
    tabla: "",
    valores: null,
    conflicto: null,
    proyeccion: "",
    tocoLaBase: false,
    pidioLaSesion: false,
  };

  const respuesta = () =>
    opciones.cortaLaConexion
      ? Promise.reject(new Error("corte de red"))
      : Promise.resolve({ data: opciones.datos ?? null, error: opciones.error ?? null });

  const escritor = {
    auth: {
      getUser: () => {
        recibido.pidioLaSesion = true;
        return Promise.resolve({ data: { user: opciones.usuario ?? null } });
      },
    },
    from(tabla: string) {
      recibido.tocoLaBase = true;
      recibido.tabla = tabla;

      const consulta = {
        upsert: (valores: Record<string, unknown>, opcionesDelUpsert?: { onConflict?: string }) => {
          recibido.valores = valores;
          recibido.conflicto = opcionesDelUpsert?.onConflict ?? null;
          return consulta;
        },
        select: (proyeccion: string) => {
          recibido.proyeccion = proyeccion;
          return consulta;
        },
        // El objeto es su propio «thenable», como en las pruebas de la #76: los dos
        // callbacks se invocan, porque si solo se encadenara el de éxito el rechazo
        // quedaría sin manejar y la promesa exterior no se resolvería nunca.
        maybeSingle: () => respuesta(),
        then: (resolvio: (valor: unknown) => unknown, rechazo: (motivo: unknown) => unknown) =>
          respuesta().then(resolvio, rechazo),
      };

      return consulta;
    },
  };

  return { cliente: escritor as unknown as SupabaseClient, recibido };
}

/** Captura `console.error` mientras se provoca la avería: el registro es correcto, la salida no. */
async function capturandoRegistros<T>(
  accion: () => Promise<T>
): Promise<{ resultado: T; registros: string }> {
  const original = console.error;
  const lineas: string[] = [];
  console.error = (...argumentos: unknown[]) => {
    lineas.push(argumentos.map(String).join(" "));
  };
  try {
    return { resultado: await accion(), registros: lineas.join("\n") };
  } finally {
    console.error = original;
  }
}

describe("el guardado del contacto privado (tarea #77)", () => {
  describe("con un número que no sirve, no se consulta nada", () => {
    it("devuelve `invalido` y no llega a tocar la base", async () => {
      // Importa que salga **antes** de crear el cliente: la restricción de la base
      // respondería `23514` sin decirle a nadie qué escribir, así que la comprobación
      // tiene que estar de este lado.
      const malos = ["", "1234567890", "2000000000", "300000000", "30000000000", "no es un número"];

      for (const malo of malos) {
        const { cliente, recibido } = crearEscritor({ usuario: { id: ANFITRION } });
        const guardado = await guardarContactoDelAnfitrion(malo, cliente);

        assert.deepEqual(guardado, { estado: "invalido" }, `«${malo}» no debería pasar`);
        assert.equal(recibido.tocoLaBase, false, `«${malo}» no debería llegar a la base`);
        assert.equal(recibido.pidioLaSesion, false, `«${malo}» no debería preguntar por la sesión`);
      }
    });

    it("acepta el celular y el fijo con indicativo, que son las dos formas de la base", async () => {
      for (const bueno of [CELULAR, FIJO, "+57 300 000 0000"]) {
        const { cliente, recibido } = crearEscritor({
          usuario: { id: ANFITRION },
          datos: { whatsapp: CELULAR },
        });
        const guardado = await guardarContactoDelAnfitrion(bueno, cliente);

        assert.equal(guardado.estado, "ok", `«${bueno}» debería pasar`);
        assert.equal(recibido.tocoLaBase, true, `«${bueno}» debería llegar a la base`);
      }
    });
  });

  describe("la identidad sale de la sesión, no de quien llame", () => {
    it("escribe la fila del usuario de la sesión", async () => {
      const { cliente, recibido } = crearEscritor({
        usuario: { id: ANFITRION },
        datos: { whatsapp: CELULAR },
      });

      await guardarContactoDelAnfitrion(CELULAR, cliente);

      // El único identificador que aparece en la escritura es el de la sesión. No hay
      // parámetro por el que un `anfitrion_id` ajeno pueda entrar.
      assert.equal(recibido.valores?.anfitrion_id, ANFITRION);
      assert.notEqual(recibido.valores?.anfitrion_id, OTRA_PERSONA);
    });

    it("sin sesión no escribe nada", async () => {
      const { cliente, recibido } = crearEscritor({ usuario: null });

      const guardado = await guardarContactoDelAnfitrion(CELULAR, cliente);

      assert.deepEqual(guardado, { estado: "sin-sesion" });
      assert.equal(recibido.tocoLaBase, false, "sin sesión no se toca la base");
    });
  });

  describe("el destino de la escritura: el criterio de aceptación, comprobado", () => {
    it("escribe en `contacto_anfitrion` y no en `pensiones`", async () => {
      const { cliente, recibido } = crearEscritor({
        usuario: { id: ANFITRION },
        datos: { whatsapp: CELULAR },
      });

      await guardarContactoDelAnfitrion(CELULAR, cliente);

      assert.equal(recibido.tabla, "contacto_anfitrion");
      assert.notEqual(recibido.tabla, "pensiones");
    });

    it("el módulo no menciona `pensiones` en su código", () => {
      // La aserción de arriba mira una llamada; ésta mira el archivo entero. Si alguien
      // añadiera mañana una segunda escritura a `pensiones.whatsapp`, el nombre aparecería
      // aquí aunque la prueba de la tabla siguiera verde.
      assert.equal(fuente("lib/contacto-anfitrion.ts").includes("pensiones"), false);
    });

    it("el registro que se envía tiene exactamente dos columnas", async () => {
      const { cliente, recibido } = crearEscritor({
        usuario: { id: ANFITRION },
        datos: { whatsapp: CELULAR },
      });

      await guardarContactoDelAnfitrion(CELULAR, cliente);

      // Las fechas las sella el disparador de la base: mandarlas sería mandar un dato
      // que la tabla ignora. Y una tercera columna significaría que este módulo está
      // escribiendo algo del anuncio, que no es asunto suyo.
      assert.deepEqual(Object.keys(recibido.valores ?? {}).sort(), ["anfitrion_id", "whatsapp"]);
    });

    it("guarda el número normalizado, sin el indicativo del país", async () => {
      const { cliente, recibido } = crearEscritor({
        usuario: { id: ANFITRION },
        datos: { whatsapp: CELULAR },
      });

      await guardarContactoDelAnfitrion("+57 300 000 0000", cliente);

      assert.equal(recibido.valores?.whatsapp, CELULAR, "la base no almacena el +57");
    });

    it("resuelve el conflicto por `anfitrion_id`, para no crear una segunda fila", async () => {
      const { cliente, recibido } = crearEscritor({
        usuario: { id: ANFITRION },
        datos: { whatsapp: CELULAR },
      });

      await guardarContactoDelAnfitrion(CELULAR, cliente);

      // La tabla tiene una fila por anfitrión: quien publica su segundo anuncio
      // actualiza la suya. Un `insert` daría un `23505` que el anfitrión leería como un
      // fallo del formulario.
      assert.equal(recibido.conflicto, "anfitrion_id");
    });

    it("pide de vuelta una proyección explícita, no todas las columnas", async () => {
      const { cliente, recibido } = crearEscritor({
        usuario: { id: ANFITRION },
        datos: { whatsapp: CELULAR },
      });

      await guardarContactoDelAnfitrion(CELULAR, cliente);

      assert.notEqual(recibido.proyeccion, "*");
      assert.equal(recibido.proyeccion, "whatsapp");
    });
  });

  describe("los estados de la falta de la tabla", () => {
    it("`PGRST205` es «todavía no está disponible», no un error", async () => {
      const { cliente } = crearEscritor({
        usuario: { id: ANFITRION },
        error: { code: "PGRST205", message: "Could not find the table" },
      });

      assert.deepEqual(await guardarContactoDelAnfitrion(CELULAR, cliente), { estado: "sin-tabla" });
    });

    it("`42P01` también, porque el error cambia según dónde falle la consulta", async () => {
      const { cliente } = crearEscritor({
        usuario: { id: ANFITRION },
        error: { code: "42P01", message: 'relation "contacto_anfitrion" does not exist' },
      });

      assert.deepEqual(await guardarContactoDelAnfitrion(CELULAR, cliente), { estado: "sin-tabla" });
    });

    it("un permiso denegado NO se disfraza de tabla ausente", async () => {
      // Es la confusión que esta ronda ya corrigió una vez: decir «no está disponible»
      // cuando lo que pasa es que no se pudo es decir lo contrario de lo cierto.
      const { cliente } = crearEscritor({
        usuario: { id: ANFITRION },
        error: { code: "42501", message: "permission denied" },
      });

      const { resultado } = await capturandoRegistros(() =>
        guardarContactoDelAnfitrion(CELULAR, cliente)
      );

      assert.deepEqual(resultado, { estado: "error" });
    });

    it("un corte de red también es «no lo sé», no «no está disponible»", async () => {
      const { cliente } = crearEscritor({ usuario: { id: ANFITRION }, cortaLaConexion: true });

      const { resultado } = await capturandoRegistros(() =>
        guardarContactoDelAnfitrion(CELULAR, cliente)
      );

      assert.deepEqual(resultado, { estado: "error" });
    });
  });

  describe("no dice que sí sin la fila devuelta", () => {
    it("una escritura sin fila de vuelta es un error, no un éxito", async () => {
      // Es el mismo criterio que las cuatro escrituras del panel: un éxito sin
      // comprobación es un éxito que no se sabe si ocurrió.
      const { cliente } = crearEscritor({ usuario: { id: ANFITRION }, datos: null });

      const { resultado } = await capturandoRegistros(() =>
        guardarContactoDelAnfitrion(CELULAR, cliente)
      );

      assert.deepEqual(resultado, { estado: "error" });
    });

    it("con la fila devuelta, devuelve el número y estado `ok`", async () => {
      const { cliente } = crearEscritor({
        usuario: { id: ANFITRION },
        datos: { whatsapp: FIJO },
      });

      assert.deepEqual(await guardarContactoDelAnfitrion(FIJO, cliente), {
        estado: "ok",
        whatsapp: FIJO,
      });
    });

    it("el número nunca acaba en los registros del servidor", async () => {
      // El módulo lo promete por escrito. Un teléfono ajeno en un `console.error` de
      // producción es un dato privado copiado a un sitio del que no se puede borrar.
      const { cliente } = crearEscritor({
        usuario: { id: ANFITRION },
        error: { code: "42501", message: "permission denied" },
      });

      const { registros } = await capturandoRegistros(() =>
        guardarContactoDelAnfitrion(CELULAR, cliente)
      );

      assert.ok(registros.length > 0, "el fallo sí se registra");
      assert.equal(registros.includes(CELULAR), false, "pero sin el número dentro");
    });
  });
});
