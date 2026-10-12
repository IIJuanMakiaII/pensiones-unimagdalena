/**
 * ¿Coinciden la demostración y su superficie pública? (tareas #58 → #66)
 *
 * LA PREGUNTA CAMBIÓ, Y POR QUÉ
 * -----------------------------
 * Este guion empezó comprobando que «Residencia 101 (Pension de Prueba)»
 * estuviera **retirada**. Ese estado ya no se puede suponer: el fundador aclaró
 * que es una demostración intencional —existe para enseñar a los primeros
 * anfitriones cómo se ve una pensión publicada— y que la oculta y la reactiva en
 * segundos con el rol de maestro desde el panel.
 *
 * Un guion que exigiera un estado concreto mentiría la mitad del tiempo: con la
 * demostración activa diría «FALLA», y con la demostración oculta daría un verde
 * que solo dice que se acordó esconderla. Lo que se comprueba ahora es la
 * **coincidencia**, y vale en los dos sentidos:
 *
 *   · si la demostración está ACTIVA, las superficies deben mostrarla;
 *   · si está OCULTA, las superficies deben esconderla.
 *
 * Eso es lo que de verdad puede romperse: que la base diga una cosa y el sitio
 * diga otra. Cuando pasa, alguien reserva una habitación que ya no está
 * publicada, o el fundador oculta la demostración para enseñar el estado sin
 * inventario y la sigue encontrando en el catálogo.
 *
 * El nombre del archivo y el del comando (`npm run verificar:retirada`) se
 * conservan porque ya están repartidos por el runbook y por la conversación del
 * equipo. Lo que cambió es lo que se mide, no cómo se le llama.
 *
 * EL VERDE FALSO QUE ESTE GUION EXISTE PARA IMPEDIR
 * -------------------------------------------------
 * Las comprobaciones sobre el sitio tienen todas la misma trampa: **cuando la
 * base no responde, pasan solas, y justo en la dirección «oculta»**.
 *
 *   · `lib/datos.ts` devuelve catálogo vacío si la consulta falla (tarea #42);
 *   · `obtenerPensionesReales()`, fuente del sitemap, devuelve lista vacía «ante
 *     cualquier duda»;
 *   · `resumenesDeBarrio()` se alimenta de esas mismas publicaciones.
 *
 * Es decir: un corte de red, o una migración sin aplicar, deja la portada sin
 * enlaces, el sitemap sin fichas y los barrios sin páginas — y una comprobación
 * ingenua leería eso como «la demostración está oculta». Por eso la primera
 * comprobación no mide nada de eso: mide si **se puede medir**. Y el estado no se
 * deduce del sitio, se **lee de la base**.
 *
 * QUÉ COMPRUEBA
 * -------------
 *   0. Que el catálogo público sea legible con la proyección de la aplicación.
 *   1. El estado de la demostración, leído de la base.
 *   2. Que la portada responda 200 y coincida con ese estado.
 *   3. Que el sitemap coincida.
 *   4. Que los barrios coincidan (dirección «oculta», que es la crítica).
 *   5. Que la ficha responda lo que toca: 200 si activa, 404 si oculta.
 *
 * LO QUE ESTE GUION NO PUEDE DEMOSTRAR, DICHO SIN ADORNOS
 * ------------------------------------------------------
 *   · Con la demostración oculta, la clave anónima no distingue «oculta» de «no
 *     existe»: las dos devuelven cero filas. Este guion mide en la dirección
 *     «oculta» y lo dice; saber que el registro sigue ahí exige una lectura con
 *     el rol de maestro.
 *   · En esa misma dirección no se conoce el título del anuncio —para leerlo
 *     haría falta verlo—, así que la búsqueda se apoya en su dirección legible.
 *     Un anuncio filtrado sin su enlace no se detectaría aquí.
 *
 * Uso:
 *   node scripts/verificar-retirada.mjs
 *   BASE_URL=https://pensiones-unimagdalena.vercel.app node scripts/verificar-retirada.mjs
 */
import { readFile } from "node:fs/promises";

/** La dirección legible de la demostración (tarea #58). */
const SLUG_DEMO = "residencia-makia";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const env = await readFile(".env.local", "utf8").catch(() => "");

function leerVariable(nombre) {
  const coincidencia = env.match(new RegExp(`^${nombre}=(.*)$`, "m"));
  return (coincidencia?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const URL_SUPABASE = leerVariable("NEXT_PUBLIC_SUPABASE_URL");
const CLAVE = leerVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

let fallos = 0;
let medible = true;

function linea(ok, etiqueta, detalle) {
  if (!ok) fallos += 1;
  console.log(`${ok ? "OK   " : "FALLA"} ${etiqueta.padEnd(46)} ${detalle}`);
}

function nota(texto) {
  console.log(`NOTA  ${texto}`);
}

function noMedible(motivo) {
  medible = false;
  fallos += 1;
  console.log(`\nDETENIDO: no se puede medir la coincidencia.\n  ${motivo}`);
  console.log(
    "\nLas comprobaciones sobre el sitio pasan solas cuando la base no responde, y justo en\n" +
      "la dirección «oculta», así que medirlas ahora daría un verde que no significa nada.\n" +
      "No se emite veredicto."
  );
  process.exit(1);
}

if (!URL_SUPABASE || !CLAVE) {
  noMedible("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
}

/**
 * La proyección de la aplicación, leída de `lib/supabase/mapeo.ts`.
 *
 * Se extrae en lugar de escribirse aquí: si mañana cambia la lista, este guion
 * tiene que fallar por la misma razón que fallaría la aplicación, y no medir una
 * consulta que ya no existe. Es la comprobación más útil de todo el archivo, y
 * de paso demuestra que las migraciones pendientes están aplicadas.
 */
async function proyeccionDeLaApp() {
  const fuente = await readFile("lib/supabase/mapeo.ts", "utf8");
  const bloque = /export const COLUMNAS_PENSION = \[([\s\S]*?)\]\.join/.exec(fuente)?.[1];
  if (!bloque) throw new Error("no se encontró COLUMNAS_PENSION en lib/supabase/mapeo.ts");
  return (bloque.match(/"[a-z_]+"/g) ?? []).map((c) => c.replace(/"/g, "")).join(",");
}

async function rest(ruta) {
  const respuesta = await fetch(`${URL_SUPABASE}/rest/v1/${ruta}`, {
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` },
  });
  const cuerpo = await respuesta.text();
  let datos = null;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    /* respuesta no JSON: se evalúa por el código de estado */
  }
  return { ok: respuesta.ok, status: respuesta.status, datos, cuerpo };
}

async function pagina(ruta) {
  try {
    const respuesta = await fetch(BASE + ruta, {
      headers: { "cache-control": "no-cache" },
      redirect: "manual",
    });
    return { status: respuesta.status, cuerpo: await respuesta.text() };
  } catch (error) {
    // `status: 0` significa «no se pudo hablar con el sitio», y se distingue de
    // un código HTTP real porque ninguna comprobación puede interpretarlo.
    return { status: 0, cuerpo: "", motivo: error.cause?.code ?? error.message };
  }
}

const menciona = (texto, titulo) =>
  texto.includes(SLUG_DEMO) || (titulo !== null && texto.includes(titulo));

console.log(`\nDemostración: ${SLUG_DEMO}`);
console.log(`Sitio medido: ${BASE}`);
console.log(`Supabase:     ${URL_SUPABASE}\n`);

/* --- 0. ¿Se puede medir? --------------------------------------------------- */
const proyeccion = await proyeccionDeLaApp();
const catalogo = await rest(`pensiones?select=${proyeccion}&limit=1`);

if (!catalogo.ok) {
  noMedible(
    `la consulta del catálogo falló (HTTP ${catalogo.status}): ${catalogo.cuerpo.slice(0, 200)}\n` +
      "  Es la consulta que usa la aplicación, con su proyección completa. Si es por una\n" +
      "  columna que falta, hay una migración sin aplicar y el catálogo está vacío por eso."
  );
}
linea(true, "El catálogo es legible con la proyección de la app", `HTTP ${catalogo.status}`);

/* --- 1. El estado, leído de la base --------------------------------------- */
// Se piden solo columnas concedidas: con la demostración oculta, la clave
// anónima puede devolver cero filas, y eso también hay que poder leerlo.
const objetivo = await rest(`pensiones?select=id,slug,titulo,barrio,activa&slug=eq.${SLUG_DEMO}`);
const fila = Array.isArray(objetivo.datos) ? objetivo.datos[0] : null;
const titulo = fila?.titulo ?? null;

if (objetivo.status === 401 || objetivo.status === 403) {
  // Con una clave anónima válida, un 401/403 aquí significa que los privilegios
  // de columna no están donde el código cree. Es la misma clase de problema que
  // una migración sin aplicar, y deja el estado sin determinar: medir hacia
  // «oculta» con el estado en duda es exactamente el verde que no queremos.
  noMedible(
    `no se pudo leer el estado de la demostración (HTTP ${objetivo.status}): ${objetivo.cuerpo.slice(0, 200)}\n` +
      "  Suele ser un privilegio de columna revocado: revisa las migraciones de permisos."
  );
}

/**
 * `activa` con la clave anónima solo puede ser `true`: la RLS entrega únicamente
 * las activas. Una fila visible con `activa` en falso contradiría la política, y
 * eso se reporta en vez de disimularlo.
 */
const estado = !fila ? "oculta-o-ausente" : fila.activa === true ? "activa" : "incoherente";
const debeVerse = estado === "activa";

console.log(`\nEstado de la demostración: ${estado.toUpperCase()}`);

if (estado === "incoherente") {
  linea(false, "El estado es coherente con la política", `visible al público con activa=${fila.activa}`);
} else if (debeVerse) {
  linea(true, "El estado es coherente con la política", `activa=true · ${titulo}`);
} else {
  nota(
    "no es visible para el público. La clave anónima no distingue «oculta» de «no existe»\n" +
      "      —las dos devuelven cero filas—, así que se mide la dirección «oculta» y no se\n" +
      "      afirma que el registro siga ahí: eso exige una lectura con el rol de maestro."
  );
}

/* --- 2. La portada --------------------------------------------------------- */
// Con cero inventario la portada debe seguir respondiendo **200** y dibujar el
// estado de captura. Un 500 no es «sin inventario»: es un catálogo roto.
const portada = await pagina("/");

if (portada.status === 0) {
  noMedible(
    `el sitio no responde en ${BASE} (${portada.motivo ?? "sin conexión"}).\n` +
      "  Levanta el servidor (npm run dev) o apunta BASE_URL al despliegue."
  );
} else if (portada.status !== 200) {
  linea(false, "La portada responde 200", `HTTP ${portada.status} — un catálogo roto no es «sin inventario»`);
} else {
  const enlaza = portada.cuerpo.includes(`/pensiones/${SLUG_DEMO}`);
  const enlaces = (portada.cuerpo.match(/\/pensiones\//g) ?? []).length;

  if (debeVerse) {
    linea(enlaza, "La portada enlaza la demostración", enlaza ? "presente" : `ausente (${enlaces} enlaces)`);
  } else {
    linea(
      !enlaza,
      "La portada no enlaza la demostración",
      `${enlaces} enlace(s) a fichas en total`
    );
  }
}

/* --- 3. El sitemap --------------------------------------------------------- */
const sitemap = await pagina("/sitemap.xml");
const anuncia = sitemap.status === 200 && sitemap.cuerpo.includes(SLUG_DEMO);

linea(
  sitemap.status === 200 && anuncia === debeVerse,
  debeVerse ? "El sitemap anuncia la demostración" : "El sitemap no anuncia la demostración",
  sitemap.status !== 200
    ? `HTTP ${sitemap.status}`
    : anuncia === debeVerse
      ? "coincide"
      : "no coincide con el estado"
);

/* --- 4. Los barrios -------------------------------------------------------- */
const indice = await pagina("/barrios");

if (indice.status === 404) {
  // Sin publicaciones activas el índice de barrios no existe. Eso es coherente
  // con «oculta»; con la demostración activa sería una superficie que falta.
  linea(
    !debeVerse,
    "Los barrios coinciden con el estado",
    "HTTP 404, no hay ningún barrio"
  );
} else {
  const rutasDeBarrio = [...new Set(indice.cuerpo.match(/\/barrios\/[a-z0-9-]+/g) ?? [])];
  const paginasDeBarrio = [];

  for (const ruta of rutasDeBarrio) {
    paginasDeBarrio.push({ ruta, cuerpo: (await pagina(ruta)).cuerpo });
  }

  if (debeVerse) {
    // Informativo a propósito: que el barrio «Otro» genere o no una página
    // pública indexable sigue siendo una decisión de producto abierta, así que
    // su ausencia no se cuenta como discrepancia. Se informa, no se aprueba:
    // un «OK» que sale siempre no comprueba nada.
    nota(
      paginasDeBarrio.some(({ cuerpo }) => menciona(cuerpo, titulo))
        ? `los barrios anuncian la demostración (${rutasDeBarrio.length} página(s) revisadas)`
        : `los barrios no la anuncian: con la demostración activa eso es una superficie que falta, no una mentira (${rutasDeBarrio.length} página(s) revisadas)`
    );
  } else {
    const sucios = paginasDeBarrio
      .filter(({ cuerpo }) => menciona(cuerpo, titulo))
      .map(({ ruta }) => ruta);

    linea(
      !menciona(indice.cuerpo, titulo) && sucios.length === 0,
      "Los barrios no anuncian la demostración",
      sucios.length === 0 ? `${rutasDeBarrio.length} página(s) revisadas` : `aparece en ${sucios.join(", ")}`
    );
  }
}

/* --- 5. La ficha ----------------------------------------------------------- */
const ficha = await pagina(`/pensiones/${SLUG_DEMO}`);
// `noindex` CONTIENE `index`, así que el patrón anterior
// (`content="[^"]*index`) daba positivo con `content="noindex"` y acusaba al 404
// de declararse indexable cuando estaba haciendo justo lo contrario.
//
// El verde falso aquí está invertido respecto a los demás: la comprobación
// fallaba **con el sitio correcto**, así que «arreglarla» habría consistido en
// volver el 404 indexable de verdad. Por eso ahora se lee el contenido del meta
// y se busca la directiva `noindex` por palabra completa: `\b` no deja que
// `index` se cuele dentro de `noindex`, y un 404 sin ninguna directiva sigue
// contando como indexable, que es lo que dice el estándar por omisión.
const metaRobots = ficha.cuerpo.match(/<meta[^>]+name="robots"[^>]*content="([^"]*)"/i);
const declaraIndexable = !/\bnoindex\b/i.test(metaRobots?.[1] ?? "");

if (debeVerse) {
  linea(ficha.status === 200, "La ficha responde 200", `HTTP ${ficha.status}`);
} else {
  linea(ficha.status === 404, "La ficha responde 404 (no un 200 con cuerpo vacío)", `HTTP ${ficha.status}`);
  // Se imprime la directiva real y no una etiqueta inventada: cuando pasa, el
  // lector ve `noindex`, que es la prueba; cuando falla, ve lo que el sitio
  // declaró de verdad, no una suposición sobre él.
  linea(!declaraIndexable, "El 404 no se declara indexable", metaRobots?.[1] ?? "sin meta robots");
}

/* --- Resumen --------------------------------------------------------------- */
if (!medible) process.exit(1);

console.log(
  fallos === 0
    ? `\nLa demostración y su superficie pública coinciden (estado: ${estado}).`
    : `\n${fallos} comprobación(es) fallidas: la superficie pública NO coincide con el estado (${estado}).`
);
process.exit(fallos === 0 ? 0 : 1);
