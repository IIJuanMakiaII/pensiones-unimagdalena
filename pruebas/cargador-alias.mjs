/**
 * Resolutor del alias `@/…` para las pruebas unitarias.
 *
 * El código de la aplicación usa `@/lib/pension`, `@/types`, etc. (alias de
 * `tsconfig.json`). Ese alias lo resuelve el compilador de Next, no Node, así que
 * una prueba que importe directamente un módulo de `lib/` fallaría al resolver
 * las rutas internas.
 *
 * Este cargador traduce `@/x` a `<raíz del proyecto>/x` (probando las
 * extensiones reales) sin añadir ninguna dependencia: es el mínimo necesario
 * para poder probar la lógica pura con el ejecutor de pruebas que ya trae Node.
 */
import { existsSync } from "node:fs";
import { dirname, resolve as resolverRuta } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolverRuta(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Módulos de Next que se sustituyen por un doble en las pruebas.
 *
 * `next/headers` no lo resuelve Node: `next` publica ese camino para su propio
 * empaquetador, no para el resolutor ESM de Node (`ERR_MODULE_NOT_FOUND`). Como
 * `utils/supabase/server.ts` lo importa, cualquier prueba que importe un módulo de
 * `lib/` que llegue hasta ahí fallaba al cargar. Se resuelve a un doble que no
 * hace nada y que falla con un mensaje claro si alguien lo llama: ninguna prueba
 * unitaria debe tener un contexto de petición. Ver `pruebas/ayudas/next-headers.mjs`.
 */
const DOBLES = {
  "next/headers": "./ayudas/next-headers.mjs",
};

export async function resolve(especificador, contexto, siguiente) {
  const doble = DOBLES[especificador];
  if (doble) {
    return {
      url: new URL(doble, import.meta.url).href,
      shortCircuit: true,
    };
  }

  if (especificador.startsWith("@/")) {
    const destino = resolverRuta(RAIZ, especificador.slice(2));
    const candidatos = [
      destino,
      `${destino}.ts`,
      `${destino}.tsx`,
      `${destino}/index.ts`,
      `${destino}/index.tsx`,
    ];

    for (const candidato of candidatos) {
      if (existsSync(candidato)) {
        return { url: pathToFileURL(candidato).href, shortCircuit: true };
      }
    }
  }

  return siguiente(especificador, contexto);
}
