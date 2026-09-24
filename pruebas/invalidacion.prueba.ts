/**
 * La invalidación del catálogo (M-22) y los dos bloqueos de Next 16 (M-21).
 *
 * Esta prueba vigila tres cosas que fallan en silencio:
 *
 *  1. **Una página que muestre el catálogo y no se invalide.** El síntoma sería
 *     una publicación que no aparece hasta que caduque su caché —una hora, en el
 *     índice de barrios y en el sitemap—, y no rompe nada: solo miente un rato.
 *     Por eso el proyecto se recorre buscando quién lee el catálogo y se exige
 *     que su ruta esté en `RUTAS_DEL_CATALOGO`.
 *  2. **Que la ruta nombrada no alcance la caché real.** No basta con tener la
 *     ruta en la lista: hay que nombrarla como Next la guarda. Se comprueba
 *     contra la compilación de verdad, leyendo las etiquetas que cada entrada
 *     prerenderizada declara en su cabecera `x-next-cache-tags`.
 *  3. **Que vuelva a entrar un bloqueo de Next 16.** `cookies()` sin esperar y
 *     `revalidateTag` de un solo argumento no rompen nada hoy, así que solo se
 *     detectan cuando alguien intenta actualizar. Aquí sí rompen.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { RUTAS_DEL_CATALOGO, type ObjetivoDeInvalidacion } from "@/lib/cache-catalogo";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Carpetas con código de la aplicación (las pruebas quedan fuera a propósito:
 *  aquí se escriben los patrones que se buscan y se encontrarían a sí mismas). */
const CARPETAS = ["app", "lib", "utils", "components"];

function archivos(carpeta: string, extensiones: string[]): string[] {
  const absoluta = join(RAIZ, carpeta);
  if (!existsSync(absoluta)) return [];

  return readdirSync(absoluta, { withFileTypes: true }).flatMap((entrada) => {
    const camino = join(absoluta, entrada.name);
    if (entrada.isDirectory()) return archivos(relative(RAIZ, camino), extensiones);
    return extensiones.some((extension) => entrada.name.endsWith(extension)) ? [camino] : [];
  });
}

/**
 * Quién lee el catálogo público. No incluye `obtenerPensionesDelAnfitrion`: esa
 * lee lo del anfitrión con su sesión y el panel es dinámico, así que no hay
 * caché que descartar.
 */
const LEE_EL_CATALOGO = /\b(obtenerPensiones|obtenerPensionesReales|obtenerPensionPorId|resolverPension)\s*\(/;

/**
 * Una página que se renderiza en cada petición. No guarda caché —ni de página
 * ni de datos—, así que no hay nada que invalidar en ella: el editor de una
 * publicación lee su pensión con el cliente público, pero al ser dinámico
 * siempre la lee fresca.
 */
const SIN_CACHE = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/;

/** La ruta pública de un archivo de `app/`, o `null` si no es una página. */
function rutaDePagina(archivo: string): string | null {
  const relativa = relative(join(RAIZ, "app"), archivo).split("\\").join("/");
  if (relativa === "sitemap.ts") return "/sitemap.xml";
  if (relativa === "page.tsx") return "/";
  if (!relativa.endsWith("/page.tsx")) return null;
  return `/${relativa.slice(0, -"/page.tsx".length)}`;
}

function objetivoDe(ruta: string): ObjetivoDeInvalidacion | undefined {
  return RUTAS_DEL_CATALOGO.find((objetivo) => objetivo.ruta === ruta);
}

/**
 * La etiqueta que Next deriva de `revalidatePath(ruta, tipo)`.
 *
 * Es un espejo de la normalización de Next (`spec-extension/revalidate.js`):
 * la ruta se convierte en `_N_T_<ruta>` y, si se le pasa el tipo, se le añade
 * `/<tipo>`. Se replica aquí, y no se importa, porque es un detalle interno del
 * marco de trabajo y esta prueba es precisamente la que vigila que siga siendo
 * así: si Next lo cambiara, esto falla y hay que decidir, no enterarse tarde.
 */
function etiquetaImplicita(objetivo: ObjetivoDeInvalidacion): string {
  return `_N_T_${objetivo.ruta}${objetivo.tipo ? `/${objetivo.tipo}` : ""}`;
}

/** Las entradas prerenderizadas que puede haber dejado una ruta. */
function entradasCompiladas(ruta: string): string[] {
  const DIRECTORIO = join(RAIZ, ".next", "server", "app");
  if (!existsSync(DIRECTORIO)) return [];

  if (ruta === "/") {
    const indice = join(DIRECTORIO, "index.meta");
    return existsSync(indice) ? [indice] : [];
  }

  const segmentos = ruta.split("/").filter(Boolean);
  const ultimo = segmentos[segmentos.length - 1];
  const carpetaPadre = join(DIRECTORIO, ...segmentos.slice(0, -1));

  // Un segmento dinámico (`[id]`) se compila una vez por instancia, con el
  // valor real en el nombre del archivo: se revisan todas.
  if (ultimo.startsWith("[")) {
    if (!existsSync(carpetaPadre)) return [];
    return readdirSync(carpetaPadre)
      .filter((nombre) => nombre.endsWith(".meta"))
      .map((nombre) => join(carpetaPadre, nombre));
  }

  const archivo = join(DIRECTORIO, ...segmentos) + ".meta";
  return existsSync(archivo) ? [archivo] : [];
}

describe("invalidación del catálogo (M-22)", () => {
  it("toda página que lee el catálogo está en la lista", () => {
    const paginas = CARPETAS.flatMap((carpeta) => archivos(carpeta, [".tsx", ".ts"]))
      .filter((archivo) => {
        const contenido = readFileSync(archivo, "utf8");
        return rutaDePagina(archivo) && LEE_EL_CATALOGO.test(contenido) && !SIN_CACHE.test(contenido);
      })
      .map((archivo) => rutaDePagina(archivo) as string);

    assert.ok(paginas.length >= 3, `Se esperaban varias páginas del catálogo; se encontraron ${paginas.length}`);

    for (const ruta of paginas) {
      const objetivo = objetivoDe(ruta);
      assert.ok(objetivo, `La página ${ruta} lee el catálogo y no está en RUTAS_DEL_CATALOGO`);

      // En una ruta dinámica el tipo no es un detalle: sin él, `revalidatePath`
      // no invalida ninguna de sus direcciones.
      if (ruta.includes("[")) {
        assert.ok(
          objetivo.tipo === "page" || objetivo.tipo === "layout",
          `La ruta dinámica ${ruta} necesita un tipo (page o layout) para invalidarse`
        );
      }
    }
  });

  it("la ruta nombrada alcanza la caché que Next guardó", () => {
    if (!existsSync(join(RAIZ, ".next", "server", "app"))) {
      // Sin compilación no hay nada que comprobar. La comprobación de arriba ya
      // cubre el olvido, así que esto no deja pasar un fallo: solo se salta lo
      // que no existe.
      return;
    }

    let revisadas = 0;

    for (const objetivo of RUTAS_DEL_CATALOGO) {
      for (const entrada of entradasCompiladas(objetivo.ruta)) {
        const { headers } = JSON.parse(readFileSync(entrada, "utf8")) as {
          headers?: Record<string, string>;
        };
        const etiquetas = (headers?.["x-next-cache-tags"] ?? "").split(",");
        const esperada = etiquetaImplicita(objetivo);

        assert.ok(
          etiquetas.includes(esperada),
          `${relative(RAIZ, entrada)} no lleva ${esperada}: revalidar ${objetivo.ruta} no lo alcanzaría.\n` +
            `Etiquetas que sí lleva: ${etiquetas.join(", ")}`
        );
        revisadas += 1;
      }
    }

    assert.ok(
      revisadas > 0,
      "Hay compilación pero ninguna entrada del catálogo: revisa RUTAS_DEL_CATALOGO"
    );
  });
});

describe("bloqueos de Next 16 (M-21 y M-22)", () => {
  const fuentes = CARPETAS.flatMap((carpeta) => archivos(carpeta, [".ts", ".tsx"])).map((archivo) => ({
    archivo,
    contenido: readFileSync(archivo, "utf8"),
  }));

  it("no queda ningún revalidateTag de un solo argumento", () => {
    const culpables = fuentes
      .filter(({ contenido }) => /\brevalidateTag\s*\(/.test(contenido))
      .map(({ archivo }) => relative(RAIZ, archivo));

    assert.deepEqual(
      culpables,
      [],
      "En Next 16 `revalidateTag` exige un segundo argumento; al publicar se invalida por ruta (lib/cache-catalogo.ts)"
    );
  });

  it("ninguna llamada a cookies() se queda sin esperar su promesa", () => {
    const culpables = fuentes.flatMap(({ archivo, contenido }) =>
      contenido
        .split("\n")
        .map((linea, indice) => ({ linea: linea.trim(), numero: indice + 1 }))
        // Se ignoran las líneas de comentario: es donde se escribe «cookies()» al
        // explicar por qué hay que esperarla.
        .filter(
          ({ linea }) =>
            /\bcookies\(\)/.test(linea) &&
            !/await\s+cookies\(\)/.test(linea) &&
            !/^(\/\/|\*|\/\*)/.test(linea)
        )
        .map(({ linea, numero }) => `${relative(RAIZ, archivo)}:${numero} → ${linea}`)
    );

    assert.deepEqual(
      culpables,
      [],
      "Desde Next 15 `cookies()` devuelve una promesa: hay que esperarla (M-21)"
    );
  });
});
