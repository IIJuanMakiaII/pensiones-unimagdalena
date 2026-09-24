/**
 * Comprobación del Service Worker: que la lista no vuelva a quedarse atrás.
 *
 * El fallo que esto previene ya ocurrió dos veces: la lista de rutas privadas
 * del Service Worker se escribía a mano y se desincronizó — `/recuperar` y
 * `/restablecer` llegaron a existir sin estar declaradas, así que su HTML podía
 * quedar guardado en el dispositivo. En un equipo compartido eso es ver la
 * pantalla de restablecer contraseña de la persona anterior.
 *
 * Este verificador **recorre las rutas reales del build** y exige que cada una
 * esté clasificada en `public/sw.js`, en una de las dos listas:
 *
 *   RUTAS_CACHEABLES  → se puede guardar (páginas idénticas para todos)
 *   RUTAS_CON_SESION  → nunca se guarda
 *
 * Si aparece una ruta nueva y nadie la clasifica, esto **falla**. No pide
 * cuidado: lo exige. (El comportamiento en tiempo de ejecución lo prueba
 * además `pruebas/service-worker.prueba.ts`, ejecutando el Service Worker de
 * verdad con cachés falsas.)
 *
 * Uso:  node scripts/verificar-sw.mjs        (requiere haber compilado antes)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUTA_SW = path.join(RAIZ, "public", "sw.js");
const RUTA_MANIFIESTO = path.join(RAIZ, ".next", "app-path-routes-manifest.json");

/** Rutas de archivo estático: no son HTML navegable ni dependen de nadie. */
const NO_ES_PAGINA = /\.(txt|xml|webmanifest|ico|png|jpe?g|svg|css|js)$/i;

/**
 * Rutas internas del framework. En el App Router las carpetas que empiezan por
 * `_` están excluidas del enrutado: no son direcciones a las que nadie navegue,
 * así que no entran en la clasificación. (`/_not-found` es el 404 del
 * framework: el usuario ve esa página en la URL que pidió, no en esta.)
 */
const ES_INTERNA = /^\/_/;

const problemas = [];

function fallar(mensaje) {
  problemas.push(mensaje);
}

// --- 1. Leer la declaración del Service Worker ------------------------------

let fuenteSw;
try {
  fuenteSw = readFileSync(RUTA_SW, "utf8");
} catch {
  console.error(`FALLO  no se pudo leer ${RUTA_SW}`);
  process.exit(1);
}

function extraerLista(nombre) {
  const bloque = fuenteSw.match(new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\];`));
  if (!bloque) {
    fallar(`no se encontró la lista ${nombre} en public/sw.js`);
    return [];
  }
  return [...bloque[1].matchAll(/"([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
}

const CACHEABLES = extraerLista("RUTAS_CACHEABLES");
const CON_SESION = extraerLista("RUTAS_CON_SESION");

// --- 2. Rutas reales del build ---------------------------------------------

let manifiesto;
try {
  manifiesto = JSON.parse(readFileSync(RUTA_MANIFIESTO, "utf8"));
} catch {
  console.error(
    "FALLO  falta .next/app-path-routes-manifest.json.\n" +
      "       Esta comprobación se ejecuta sobre las rutas reales, así que necesita el build:\n" +
      "       ejecuta `npm run build` antes."
  );
  process.exit(1);
}

const rutas = Object.values(manifiesto)
  .filter((ruta) => typeof ruta === "string")
  .filter((ruta) => !NO_ES_PAGINA.test(ruta))
  .filter((ruta) => !ES_INTERNA.test(ruta))
  .sort();

// --- 3. Coincidencia: la misma regla que usa el Service Worker --------------

const coincide = (ruta, patron) =>
  ruta === patron || (patron !== "/" && ruta.startsWith(`${patron}/`));

const clasificar = (ruta) => {
  const cacheable = CACHEABLES.some((patron) => coincide(ruta, patron));
  const conSesion = CON_SESION.some((patron) => coincide(ruta, patron));
  return { cacheable, conSesion };
};

// --- 4. Las tres comprobaciones --------------------------------------------

const tabla = [];

for (const ruta of rutas) {
  const { cacheable, conSesion } = clasificar(ruta);

  if (cacheable && conSesion) {
    fallar(`«${ruta}» está declarada como cacheable Y como ruta con sesión`);
  } else if (!cacheable && !conSesion) {
    fallar(
      `«${ruta}» no está clasificada: añádela a RUTAS_CACHEABLES o a RUTAS_CON_SESION en public/sw.js`
    );
  }

  tabla.push({
    ruta,
    clase: cacheable && !conSesion ? "se puede guardar" : conSesion ? "con sesión" : "SIN CLASIFICAR",
  });
}

// Entradas declaradas que no corresponden a ninguna ruta real (erratas, rutas borradas).
for (const [nombre, lista] of [
  ["RUTAS_CACHEABLES", CACHEABLES],
  ["RUTAS_CON_SESION", CON_SESION],
]) {
  for (const patron of lista) {
    const usada = rutas.some((ruta) => coincide(ruta, patron));
    if (!usada) {
      fallar(`${nombre} declara «${patron}», que no corresponde a ninguna ruta real`);
    }
  }
}

// Guardas estructurales del propio Service Worker.
if (!/const COOKIE_SESION\s*=/.test(fuenteSw)) {
  fallar("el Service Worker ya no define COOKIE_SESION: falta la guarda que no depende de listas");
}
if (!/(const|function)\s+puedeGuardarse\s*[(=]/.test(fuenteSw)) {
  fallar("el Service Worker ya no define puedeGuardarse: no hay una única decisión de escritura");
}
if (!/puedeGuardarse\(solicitud, url\.pathname\)/.test(fuenteSw)) {
  fallar("la decisión de guardar ya no se consulta en el manejador de peticiones");
}
if (!/esRutaConSesion\(url\.pathname\)/.test(fuenteSw)) {
  fallar("el Service Worker ya no descarta las rutas con sesión antes de tocar la caché");
}

// --- 5. Informe -------------------------------------------------------------

const ancho = Math.max(...tabla.map((fila) => fila.ruta.length), 5);
console.log(`Rutas del build analizadas: ${tabla.length}`);
console.log(`Declaradas en public/sw.js: ${CACHEABLES.length} cacheables · ${CON_SESION.length} con sesión\n`);

for (const { ruta, clase } of tabla) {
  const marca = clase === "se puede guardar" ? "cacheable " : clase === "con sesión" ? "con sesión" : "SIN CLASE ";
  console.log(`  ${marca}  ${ruta.padEnd(ancho)}`);
}

console.log("");

if (problemas.length > 0) {
  console.error(`FALLO  ${problemas.length} problema(s):\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error(
    "\nRegla: ninguna página que dependa de la sesión puede ser cacheable; y ninguna ruta puede\n" +
      "quedarse sin clasificar. Si la ruta es nueva y es pública, añádela a RUTAS_CACHEABLES."
  );
  process.exit(1);
}

console.log("OK  todas las rutas están clasificadas y ninguna con sesión es cacheable");
