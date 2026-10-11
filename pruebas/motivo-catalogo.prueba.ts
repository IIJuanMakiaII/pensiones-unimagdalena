/**
 * El motivo del catálogo cuando no devuelve anuncios (tarea #67).
 *
 * EL FALLO QUE ESTA PRUEBA CIERRA
 * -------------------------------
 * `obtenerPensiones()` devolvía un arreglo pelado, así que la portada recibía el
 * mismo valor —una lista vacía— en dos situaciones que no se parecen en nada:
 *
 *   · la base está configurada y **no respondió** (una avería); y
 *   · la base respondió y **no hay inventario** (un estado legítimo).
 *
 * Con esa ambigüedad, un corte de la base se publicaba como «Todavía no hay
 * pensiones publicadas»: una frase cierta sobre el negocio y falsa sobre el
 * sistema. Nadie se enteraba de la avería, y el negocio quedaba retratado como
 * si no tuviera nada que ofrecer.
 *
 * Ahora la lista viaja con su motivo, y esta prueba demuestra que los dos vacíos
 * se pueden separar.
 *
 * CÓMO SE PRUEBA, Y POR QUÉ ASÍ
 * -----------------------------
 * Se conduce la función **real** (`obtenerCatalogo`) contra un lector sembrado
 * que imita la cadena de Supabase, en lugar de comprobar el texto del archivo.
 * La costura es la misma que ya usa `resolverPensionConSesion()`: el cliente se
 * puede inyectar **solo** para las pruebas, y ningún camino de la aplicación
 * pasa ese argumento.
 *
 * Lo que esto NO demuestra: que la base real devuelva esos errores. La forma de
 * la respuesta de PostgREST se da por buena; lo que se mide aquí es qué **hace**
 * el cargador con ella, que es lo que decide el mensaje de la portada.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { obtenerCatalogo, obtenerPensiones } from "@/lib/datos";
import { esFalloDeLectura } from "@/lib/catalogo-respaldo";

/**
 * Un lector de Supabase en miniatura.
 *
 * Reproduce la cadena que usa el cargador —`.from(t).select(c).eq(c, v).order(c)`
 * más el `await` directo sobre la consulta, que es lo que hace la lectura de
 * habitaciones— y solo dos comportamientos: responder vacío, responder con error
 * o cortar la conexión.
 */
function crearLector(opciones: {
  error?: { message: string } | null;
  cortaLaConexion?: boolean;
}): SupabaseClient {
  const lector = {
    from() {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: () => consulta,
        // Tiene que comportarse como un «thenable» de verdad: los dos callbacks
        // se invocan. Si solo se encadenara el de éxito, el rechazo quedaría sin
        // manejar y la promesa exterior nunca se resolvería —el fallo lo detectó
        // esta misma prueba, en su primera ejecución—.
        then: (
          resolvio: (valor: unknown) => unknown,
          rechazo: (motivo: unknown) => unknown
        ) =>
          opciones.cortaLaConexion
            ? Promise.reject(new Error("corte de red")).then(resolvio, rechazo)
            : Promise.resolve({ data: [], error: opciones.error ?? null }).then(resolvio, rechazo),
      };

      return consulta;
    },
  };

  return lector as unknown as SupabaseClient;
}

/**
 * Silencia `console.error` mientras se provoca la avería.
 *
 * El cargador registra el fallo a propósito, y ese registro es correcto; lo que
 * no puede es ensuciar la salida de la batería hasta hacerla ilegible.
 */
async function sinRuido<T>(accion: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await accion();
  } finally {
    console.error = original;
  }
}

describe("el motivo del catálogo (tarea #67)", () => {
  it("una base que responde con error se marca como fallo de lectura", async () => {
    const catalogo = await sinRuido(() =>
      obtenerCatalogo(crearLector({ error: { message: "canceling statement due to statement timeout" } }))
    );

    assert.equal(catalogo.motivo, "error");
    assert.deepEqual(catalogo.pensiones, []);
    assert.equal(esFalloDeLectura(catalogo), true);
  });

  it("una conexión que se corta también es un fallo de lectura", async () => {
    const catalogo = await sinRuido(() => obtenerCatalogo(crearLector({ cortaLaConexion: true })));

    assert.equal(catalogo.motivo, "error");
    assert.deepEqual(catalogo.pensiones, []);
  });

  it("con la base bien y cero anuncios, el motivo es null: eso es «sin inventario»", async () => {
    const catalogo = await obtenerCatalogo(crearLector({}));

    assert.equal(catalogo.motivo, null);
    assert.deepEqual(catalogo.pensiones, []);
    assert.equal(esFalloDeLectura(catalogo), false);
  });

  it("los dos vacíos son distinguibles, que es justo lo que la portada necesita", async () => {
    const averia = await sinRuido(() => obtenerCatalogo(crearLector({ error: { message: "timeout" } })));
    const sinInventario = await obtenerCatalogo(crearLector({}));

    // Las dos listas son idénticas: por eso el arreglo pelado no bastaba.
    assert.deepEqual(
      averia.pensiones,
      sinInventario.pensiones,
      "las dos listas están vacías, y seguirá siendo así: la diferencia no puede estar en la lista"
    );
    assert.notEqual(averia.motivo, sinInventario.motivo, "el motivo es lo que las separa");
    assert.equal(esFalloDeLectura(averia), true);
    assert.equal(esFalloDeLectura(sinInventario), false);
  });

  it("`obtenerPensiones()` sigue devolviendo solo la lista", () => {
    // Es la firma que ya consumía `app/page.tsx`: si esta prueba necesita
    // cambiar, es que se rompió el contrato, no que se mejoró.
    //
    // No se afirma cuántos anuncios trae a propósito: eso depende de si hay
    // credenciales y de si la demostración está encendida en este entorno. Lo
    // que se afirma es la forma, que es lo único que el contrato promete.
    return obtenerPensiones().then((pensiones) => {
      assert.ok(Array.isArray(pensiones), "`obtenerPensiones()` debe seguir devolviendo un arreglo");
    });
  });
});
