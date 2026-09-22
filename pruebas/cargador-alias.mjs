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

export async function resolve(especificador, contexto, siguiente) {
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
