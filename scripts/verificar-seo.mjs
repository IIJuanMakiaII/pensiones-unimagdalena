/**
 * Verificación de datos estructurados y contenido SEO sobre el HTML compilado.
 *
 * Uso: node scripts/verificar-seo.mjs        (requiere haber ejecutado npm run build)
 *
 * Se adapta a los dos estados posibles del proyecto:
 *  - CON catálogo: hay fichas prerenderizadas (6 en modo demo, N con Supabase).
 *  - SIN catálogo: la base está vacía y aún no hay publicaciones.
 *
 * Comprueba, entre otras cosas, que NO se emitan datos inventados:
 *  - sin `aggregateRating` / `reviewCount` (reseñas que no existen)
 *  - sin la palabra "reseñas" en el contenido visible
 */
import { readFile } from "node:fs/promises";

const RUTA_INICIO = ".next/server/app/index.html";
const DIR_FICHAS = ".next/server/app/pensiones";
const MANIFIESTO = ".next/prerender-manifest.json";

/** @typedef {"siempre" | "con-catalogo" | "sin-catalogo"} Aplica */

/** [etiqueta, texto, esperado, aplica] */
const INVARIANTES = [
  ["JSON-LD WebSite", "WebSite", "presente", "siempre"],
  ["JSON-LD Organization", "Organization", "presente", "siempre"],
  ["El sitio NO se declara alojamiento", "LodgingBusiness", "ausente", "siempre"],
  ["Sin coordenadas fijas del sitio", "GeoCoordinates", "ausente", "siempre"],
  ["Sin contador de reseñas inventado", "reseñas", "ausente", "siempre"],
  ["Sin peticiones a Google Fonts", "fonts.googleapis.com", "ausente", "siempre"],
  ["Enlace a publicación de anfitriones", "Publicar mi pensión", "presente", "siempre"],
  ["Sellos de confianza", "Soporte para estudiantes y padres", "presente", "siempre"],
  ["Filtro de favoritos", "Mis favoritas", "presente", "siempre"],
  ["Catálogo renderizado en el servidor", "Pensión Costa Verde", "presente", "con-catalogo"],
  ["Puntaje honesto en las tarjetas", "Puntaje del equipo", "presente", "con-catalogo"],
  ["Estado vacío explicado al usuario", "Todavía no hay pensiones publicadas", "presente", "sin-catalogo"],
];

/** [etiqueta, texto, esperado] — se aplican a la primera ficha encontrada */
const FICHA = [
  ["JSON-LD LodgingBusiness (aquí sí aplica)", "LodgingBusiness", "presente"],
  ["AggregateRating (debe estar ausente)", "aggregateRating", "ausente"],
  ["reviewCount (debe estar ausente)", "reviewCount", "ausente"],
  ["Contador de reseñas inventado", "reseñas", "ausente"],
  ["Puntaje honesto del puntaje", "Puntaje del equipo", "presente"],
  ["Galería del carrusel", "Galería de", "presente"],
  ["Favoritos en la ficha", "Guardar", "presente"],
  ["Marco adaptativo de foto (vertical se ve completa)", "bg-neutro-100", "presente"],
  ["Portada más alta para fotos verticales", "h-72", "presente"],
  ["Descripción respeta los saltos de línea", "whitespace-pre-line", "presente"],
];

let fallos = 0;
const revisar = (etiqueta, texto, esperado, html) => {
  const esta = html.includes(texto);
  const correcto = esperado === "presente" ? esta : !esta;
  if (!correcto) fallos++;
  console.log(
    `  ${correcto ? "OK   " : "FALLA"} ${etiqueta.padEnd(48)} [${esta ? "presente" : "ausente"}, se esperaba ${esperado}]`
  );
};

// --- Home ---
let inicio = "";
try {
  inicio = await readFile(RUTA_INICIO, "utf8");
} catch {
  console.log(`ERROR  No se pudo leer ${RUTA_INICIO} (¿ejecutaste npm run build?)`);
  process.exit(1);
}

/**
 * ¿Qué fichas generó el build?
 *
 * La lista se toma del manifiesto de prerenderizado —la fuente oficial de las
 * páginas que produjo `next build`— y no de un `readdir` del directorio: ahí
 * también aparecen los HTML que el servidor crea en tiempo de ejecución
 * (peticiones a ids inexistentes o de prueba), y medir uno de esos produjo
 * fallos falsos dos veces (se llegó a leer una ficha de prueba en lugar de la
 * publicación real).
 */
let archivosFicha = [];
try {
  const manifiesto = JSON.parse(await readFile(MANIFIESTO, "utf8"));
  archivosFicha = Object.keys(manifiesto.routes ?? {})
    .filter((ruta) => ruta.startsWith("/pensiones/"))
    .map((ruta) => `${ruta.slice("/pensiones/".length)}.html`);
} catch {
  archivosFicha = [];
}

const hayCatalogo = archivosFicha.length > 0;

console.log(`\n=== Home (${RUTA_INICIO}) ===`);
console.log(
  `Modo detectado: ${
    hayCatalogo
      ? `con catálogo (${archivosFicha.length} ficha/s prerenderizada/s)`
      : "sin catálogo (base vacía)"
  }\n`
);
for (const [etiqueta, texto, esperado, aplica] of INVARIANTES) {
  if (aplica === "siempre" || (aplica === "con-catalogo") === hayCatalogo) {
    revisar(etiqueta, texto, esperado, inicio);
  }
}

// --- Primera ficha ---
if (hayCatalogo) {
  const archivo = archivosFicha[0];
  const ruta = `${DIR_FICHAS}/${archivo}`;
  console.log(`\n=== Ficha (${ruta}) ===`);
  const ficha = await readFile(ruta, "utf8");
  for (const [etiqueta, texto, esperado] of FICHA) {
    revisar(etiqueta, texto, esperado, ficha);
  }

  /**
   * El `priceRange` de los datos estructurados debe corresponder a algo que se
   * pueda reservar (tarea #13): si la ficha ofrece reservar, tiene que declarar
   * el precio; si no queda ninguna habitación libre —o el anuncio aún no tiene
   * habitaciones— no debe declararlo, porque Google y los buscadores de IA leen
   * ese campo y anunciar un precio no reservable es peor que no anunciarlo.
   *
   * Antes esta comprobación exigía `priceRange` siempre, lo que contradecía la
   * regla anterior: se midió con una ficha sin habitaciones libres.
   */
  const ofreceReserva =
    ficha.includes("Reservar por WhatsApp") || ficha.includes(">Reservar<");
  revisar(
    "Precio estructurado coherente con la reserva",
    "priceRange",
    ofreceReserva ? "presente" : "ausente",
    ficha
  );
} else {
  console.log("\n=== Ficha ===\n  (omitida: no hay pensiones publicadas, no se prerenderiza ninguna ficha)");
}

/* -------------------------------------- robots.txt y sitemap.xml (tarea #24) --- */

console.log("\n=== robots.txt y sitemap.xml ===");
try {
  const robots = await readFile(".next/server/app/robots.txt.body", "utf8");
  revisar("robots.txt permite el catálogo", "Allow: /", "presente", robots);
  revisar("robots.txt excluye la zona privada", "Disallow: /publicar", "presente", robots);
  revisar("robots.txt anuncia el sitemap", "Sitemap:", "presente", robots);
} catch {
  // Sin archivo, la comprobación debe FALLAR (no omitirse en silencio).
  revisar("robots.txt generado en el build", "robots.txt", "presente", "");
}

try {
  const sitemap = await readFile(".next/server/app/sitemap.xml.body", "utf8");
  revisar("sitemap.xml incluye la portada", "<loc>", "presente", sitemap);
  // Lo que entra en el sitemap se indexa: la demo de presentaciones nunca debe
  // aparecer aquí, o al apagarla quedarían fichas fantasma en Google.
  revisar("sitemap.xml NO anuncia la demo", "pension-costa-verde", "ausente", sitemap);
  revisar("sitemap.xml no anuncia rutas privadas", "/login", "ausente", sitemap);
  revisar("sitemap.xml no anuncia la edición", "/editar", "ausente", sitemap);
} catch {
  revisar("sitemap.xml generado en el build", "sitemap.xml", "presente", "");
}

console.log(
  fallos === 0
    ? `\nTodas las verificaciones pasaron (${hayCatalogo ? "con catálogo" : "catálogo vacío"}).`
    : `\n${fallos} verificación(es) con problemas.`
);
process.exit(fallos === 0 ? 0 : 1);
