/**
 * ¿Puede alguien sin sesión obtener el WhatsApp privado del anfitrión? (tarea #76)
 *
 * Comprobación de SOLO LECTURA. No escribe una fila y no necesita credenciales
 * privilegiadas: usa exactamente la misma clave pública que viaja al navegador,
 * que es el punto de vista de quien ataca — quien consulte la API directamente
 * no pasa por la aplicación, así que la mitigación que vive en el código no le
 * afecta.
 *
 * QUÉ COMPRUEBA, Y SON CUATRO COSAS DISTINTAS
 *
 *   1. La proyección del catálogo (`COLUMNAS_PENSION`) no incluye el número.
 *      Es la garantía que depende del código, y la lee del propio código en vez
 *      de copiarla: una lista copiada se queda atrás sola.
 *   2. Una consulta **anónima** no obtiene el número por ninguna de las dos
 *      puertas donde podría vivir: la tabla nueva `contacto_anfitrion` y la
 *      columna heredada `pensiones.whatsapp`.
 *   3. El número no aparece en el HTML de **la portada, la ficha del anuncio ni
 *      el sitemap**. Aquí no se busca un número concreto —eso exigiría conocerlo
 *      y guardarlo en el repositorio— sino **cualquier** número colombiano que no
 *      esté declarado como público. Es más estricto que buscar uno: atrapa
 *      también el número de un anfitrión que nadie había puesto en la lista.
 *   4. El patrón del número es el MISMO en la base y en el código. Si se separan,
 *      una de las dos puertas miente: o el formulario deja pasar algo que la base
 *      rechaza con un error opaco, o la base acepta algo que el formulario nunca
 *      enseñó a escribir.
 *
 * LO QUE **NO** COMPRUEBA, Y SE DICE EN VEZ DE TAPARSE
 *
 *   · La RLS no se puede medir sin sesión: que un anfitrión no vea el número de
 *     otro necesita una cuenta. Aquí se comprueba la mitad demostrable sin
 *     sesión —que la tabla no es alcanzable— y la otra mitad va escrita como
 *     prueba funcional al final de `supabase/oleada-15-contacto-anfitrion-privado.sql`.
 *   · Que un número concreto NO esté en el HTML de una página que no se pudo
 *     descargar. Si una página no responde, esto lo dice y falla: «no lo pude
 *     mirar» no es «no estaba».
 *
 * CÓMO SABE FALLAR
 *
 *   Un verificador que nunca ha visto un fallo no está verificado. Al final se
 *   ejecuta un **control positivo** sobre el propio detector: se le dan seis
 *   casos con respuesta conocida —incluido un HTML con un número inyectado— y se
 *   comprueba que los seis se resuelven como se espera. Si el detector dejara de
 *   detectar, el control lo diría antes que la red.
 *
 * Uso:    npm run verificar:contacto-privado
 * Salida: 0 = no hay fuga observable (y se dice en qué estado se midió)
 *         1 = hay fuga, o no se pudo comprobar algo
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** La migración que crea la tabla privada. Su patrón se compara con el del código. */
const ARCHIVO_MIGRACION = "supabase/oleada-15-contacto-anfitrion-privado.sql";

/**
 * Los números que SÍ pueden aparecer en el HTML, y el motivo de cada uno.
 *
 * Todos son de la plataforma: el botón de reserva abre su WhatsApp y el JSON-LD
 * declara su teléfono (app/layout.tsx). Cualquier otro número colombiano en una
 * página pública es una fuga, y da igual de quién sea.
 *
 * Se puede ampliar con `NIDO_NUMEROS_PUBLICOS` (separados por comas) para
 * números que se publiquen a propósito más adelante. La lista se imprime en cada
 * corrida justamente para que una ampliación no pueda pasar inadvertida.
 */
const NUMEROS_PUBLICOS_DECLARADOS = [];

// ---------------------------------------------------------------------------
// Lectura del entorno
// ---------------------------------------------------------------------------

/**
 * Del `.env.local` del proyecto, o del entorno si ya viene exportado.
 *
 * Los huecos alrededor del `=` son `[ \t]` y no `\s`: `\s` incluye el salto de
 * línea, así que una variable **vacía** hacía que la expresión siguiera hasta la
 * línea siguiente y devolviera su texto como si fuera el valor. Pasó de verdad
 * en la primera corrida de este guion —`NEXT_PUBLIC_SITE_URL` está declarada sin
 * valor—, y el síntoma fue que el guion buscaba las páginas en una dirección que
 * no existía: tres fallos que parecían de red y eran de lectura.
 *
 * Las líneas de comentario se descartan antes, por el mismo motivo.
 */
function leerVariable(nombre) {
  if (process.env[nombre]) return process.env[nombre].trim();

  let env = "";
  try {
    env = readFileSync(join(RAIZ, ".env.local"), "utf8");
  } catch {
    return "";
  }

  const lineas = env.split(/\r?\n/).filter((linea) => !linea.trimStart().startsWith("#"));
  const coincidencia = lineas
    .join("\n")
    .match(new RegExp(`^[ \\t]*${nombre}[ \\t]*=[ \\t]*(.*)$`, "m"));

  return (coincidencia?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const URL_BASE = leerVariable("NEXT_PUBLIC_SUPABASE_URL");
const CLAVE = leerVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

/**
 * Dónde mirar las páginas públicas.
 *
 * `NEXT_PUBLIC_SITE_URL` puede estar declarada y vacía (lo está), así que no
 * basta con que la línea exista: tiene que parecer una dirección. Si no lo
 * parece, se usa el dominio del proyecto —y se dice en pantalla cuál se usó, que
 * es lo que permite reproducir la corrida—.
 */
const SITIO_DECLARADO = leerVariable("NEXT_PUBLIC_SITE_URL");
const SITIO = /^https?:\/\//i.test(SITIO_DECLARADO)
  ? SITIO_DECLARADO.replace(/\/+$/, "")
  : "https://pensiones-unimagdalena.vercel.app";

if (!URL_BASE || !CLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// El detector de números, con su control positivo
// ---------------------------------------------------------------------------

/**
 * Formas de un número colombiano en un texto: celular (`3` + 9 dígitos) y fijo
 * con indicativo (`60` + 8), con o sin `+57` y con o sin separadores.
 *
 * El `(?<!\d)` delante es la pieza que evita el falso positivo que arruinaría
 * este guion: sin él, cualquier trozo de diez dígitos dentro de un
 * identificador, una marca de tiempo o un hash se leería como un teléfono. La
 * contrapartida es honesta y se asume: un número pegado a más dígitos no se
 * distingue, y por eso este guion no sustituye a la revisión de quien publica.
 */
const PATRONES_TELEFONO = [
  /(?<!\d)(?:\+?57)?3\d{9}(?!\d)/g,
  /(?<!\d)(?:\+?57)?60\d{8}(?!\d)/g,
  /(?<!\d)(?:\+?57)?3\d{2}[\s.\-]\d{3}[\s.\-]\d{4}(?!\d)/g,
  /(?<!\d)(?:\+?57)?60\d[\s.\-]?\d{3}[\s.\-]?\d{4}(?!\d)/g,
];

/** Deja cualquier forma en los diez dígitos que guarda la base. */
function normalizarNumero(valor) {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 12 && digitos.startsWith("57")) return digitos.slice(2);
  return digitos;
}

/**
 * Los números del HTML que NO están declarados como públicos.
 *
 * Devuelve la lista de coincidencias únicas, ya normalizadas. Lista vacía = el
 * HTML no publica ningún número ajeno.
 */
function numerosAjenos(html, permitidos) {
  const permitidosNormalizados = new Set(permitidos.map(normalizarNumero));
  const encontrados = new Set();

  for (const patron of PATRONES_TELEFONO) {
    for (const coincidencia of html.matchAll(patron)) {
      const numero = normalizarNumero(coincidencia[0]);
      if (numero.length === 10 && !permitidosNormalizados.has(numero)) {
        encontrados.add(numero);
      }
    }
  }

  return [...encontrados];
}

/** Cuántas veces aparece un número declarado como público: es la prueba de que el detector miró donde debía. */
function contarPublicos(html, permitidos) {
  let total = 0;
  for (const patron of PATRONES_TELEFONO) {
    for (const coincidencia of html.matchAll(patron)) {
      if (permitidos.includes(normalizarNumero(coincidencia[0]))) total++;
    }
  }
  return total;
}

/**
 * Cómo se lee una respuesta de la API. Es la función que decide el veredicto, así
 * que es la que más merece un control positivo.
 *
 *   abierto      → 200: se puede leer. Es una fuga, aunque venga vacío.
 *   cerrado      → 401/403, o el 42501 de «permiso denegado».
 *   sin-tabla    → la tabla no existe: la migración no está aplicada. NO es una
 *                  fuga ni un error, y no se cuenta como cierre.
 *   indeterminado→ cualquier otra cosa. No se cuenta como cierre: «no lo sé» no
 *                  es «está cerrado», y confundirlos deja una puerta abierta
 *                  creyéndola cerrada.
 */
function clasificar(status, texto) {
  if (status === 200 || status === 206) return "abierto";
  if (status === 401 || status === 403) return "cerrado";

  if (/42501|permission denied|insufficient_privilege/i.test(texto ?? "")) return "cerrado";
  if (status === 404 && /PGRST205|42P01|could not find the table|schema cache/i.test(texto ?? "")) {
    return "sin-tabla";
  }

  return "indeterminado";
}

/**
 * El control positivo: seis casos con respuesta conocida.
 *
 * El cuarto es el que más importa —un HTML con el número inyectado tiene que
 * salir marcado—, porque es la prueba de que este guion **sabe fallar**. El
 * quinto y el sexto cuidan lo contrario: que no marque lo que no es un teléfono,
 * porque un verificador que grita en falso se acaba ignorando.
 */
const CASOS_DE_CONTROL = [
  {
    nombre: "detecta un número colombiano suelto en el HTML",
    calcular: () => numerosAjenos("<p>Llámame al 3001234567</p>", ["3009998888"]),
    esperado: ["3001234567"],
  },
  {
    nombre: "detecta un número escrito con separadores y +57",
    calcular: () => numerosAjenos("<p>+57 300 123 4567</p>", []),
    esperado: ["3001234567"],
  },
  {
    nombre: "detecta un número dentro de un enlace wa.me",
    calcular: () => numerosAjenos('<a href="https://wa.me/573001234567">', []),
    esperado: ["3001234567"],
  },
  {
    nombre: "no marca el número que sí es público",
    calcular: () => numerosAjenos('wa.me/573009998888 y "telephone":"+573009998888"', ["3009998888"]),
    esperado: [],
  },
  {
    nombre: "no marca diez dígitos dentro de una cadena más larga",
    calcular: () => numerosAjenos('{"id":"99300123456755"}', []),
    esperado: [],
  },
  {
    nombre: "no marca precios ni fechas",
    calcular: () => numerosAjenos("<p>600000 desde 2026-10-11 1759123456</p>", []),
    esperado: [],
  },
  {
    nombre: "una tabla legible es exposición, aunque venga vacía",
    calcular: () => clasificar(200, "[]"),
    esperado: "abierto",
  },
  {
    nombre: "un permiso denegado es cierre",
    calcular: () => clasificar(401, '{"code":"42501","message":"permission denied for table"}'),
    esperado: "cerrado",
  },
  {
    nombre: "una tabla que no existe NO es un cierre",
    calcular: () => clasificar(404, '{"code":"PGRST205","message":"Could not find the table"}'),
    esperado: "sin-tabla",
  },
];

let problemas = 0;
let avisos = 0;

console.log(`Proyecto:  ${URL_BASE}`);
console.log(
  `Sitio:     ${SITIO}${/^https?:\/\//i.test(SITIO_DECLARADO) ? "" : "  (por defecto: NEXT_PUBLIC_SITE_URL está vacía)"}`
);
console.log(`Clave:     pública (anon), la misma que viaja al navegador\n`);

// ---------------------------------------------------------------------------
// Control positivo del propio detector
// ---------------------------------------------------------------------------
console.log("CONTROL el detector y el clasificador saben fallar:");

for (const caso of CASOS_DE_CONTROL) {
  let obtenido;
  try {
    obtenido = caso.calcular();
  } catch (error) {
    obtenido = `excepción: ${error.message}`;
  }

  const bien = JSON.stringify(obtenido) === JSON.stringify(caso.esperado);
  if (!bien) problemas++;

  console.log(
    `  ${bien ? "OK   " : "FALLA"} ${caso.nombre}${bien ? "" : `  → esperado ${JSON.stringify(caso.esperado)}, obtenido ${JSON.stringify(obtenido)}`}`
  );
}

// ---------------------------------------------------------------------------
// 1) La proyección del catálogo no lleva el número
//
// Se lee del código, no se copia: una lista copiada se queda atrás sola y este
// verificador mediría la lista vieja sin avisar.
// ---------------------------------------------------------------------------
const COLUMNA_PRIVADA = "whatsapp";

function columnasDelCatalogo() {
  const fuente = readFileSync(join(RAIZ, "lib/supabase/mapeo.ts"), "utf8");
  const bloque = fuente.match(/COLUMNAS_PENSION\s*=\s*\[([\s\S]*?)\]\s*\.join/);

  if (!bloque) {
    throw new Error(
      "No se pudo leer COLUMNAS_PENSION de lib/supabase/mapeo.ts. Si cambió su forma, actualiza esta comprobación."
    );
  }

  const columnas = [...bloque[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  if (columnas.length < 5) {
    throw new Error(
      `Solo se leyeron ${columnas.length} columnas del mapeo: la lista no es fiable y medir con ella no significaría nada.`
    );
  }

  return columnas;
}

try {
  const columnas = columnasDelCatalogo();
  const llevaElNumero = columnas.includes(COLUMNA_PRIVADA);

  if (llevaElNumero) problemas++;
  console.log(
    `\n${llevaElNumero ? "FALLA " : "OK    "} la proyección del catálogo no pide el número  ${columnas.length} columnas, leídas de lib/supabase/mapeo.ts`
  );
  if (llevaElNumero) {
    console.log(
      "        └─ la proyección se amplió: todo lo que llega al mapeo acaba en el HTML de la página"
    );
  }
} catch (error) {
  problemas++;
  console.log(`\nFALLA  no se pudo leer la proyección del catálogo: ${error.message}`);
}

// ---------------------------------------------------------------------------
// 2) El número no se puede obtener sin sesión — por ninguna de las dos puertas
// ---------------------------------------------------------------------------

/** Una consulta de solo lectura. Devuelve el estado y el cuerpo, o el motivo del fallo. */
async function pedir(ruta) {
  try {
    const respuesta = await fetch(`${URL_BASE}${ruta}`, {
      headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` },
      signal: AbortSignal.timeout(20000),
    });
    const cuerpo = await respuesta.text();
    return { status: respuesta.status, texto: cuerpo };
  } catch (error) {
    return { status: 0, texto: error.message };
  }
}

console.log("\nEl número, visto desde fuera (clave anónima, sin sesión):");

const PUERTAS = [
  [
    "/rest/v1/contacto_anfitrion?select=whatsapp&limit=1",
    "tabla privada `contacto_anfitrion`          (tabla nueva, tarea #76)",
  ],
  [
    "/rest/v1/contacto_anfitrion?select=*&limit=1",
    "tabla privada con comodín `select=*`        (tabla nueva)",
  ],
  [
    "/rest/v1/pensiones?select=whatsapp&limit=1",
    "columna heredada `pensiones.whatsapp`      (cerrada en la oleada 10)",
  ],
];

const estados = [];

for (const [ruta, etiqueta] of PUERTAS) {
  const lectura = await pedir(ruta);
  const estado = clasificar(lectura.status, lectura.texto);
  estados.push({ etiqueta, estado });

  const marca = estado === "abierto" ? "FALLA " : estado === "indeterminado" ? "FALLA " : "OK    ";
  console.log(`${marca} ${etiqueta.padEnd(58)} HTTP ${lectura.status} · ${estado}`);

  if (estado === "abierto") {
    problemas++;
    console.log("        └─ SE PUEDE LEER SIN SESIÓN. Si es la tabla nueva, la migración no está aplicada o el");
    console.log("           `revoke` no entró; si es la columna heredada, se reabrió lo que cerró la oleada 10.");
  }

  if (estado === "indeterminado") {
    problemas++;
    console.log(`        └─ respuesta inesperada: ${lectura.texto.slice(0, 200)}`);
  }
}

const sinAplicar = estados.every((e) => e.estado === "sin-tabla");

if (sinAplicar) {
  avisos++;
  console.log(
    "\nNOTA  la tabla no existe todavía: `supabase/oleada-15-contacto-anfitrion-privado.sql` no está aplicada."
  );
  console.log(
    "      Esto NO demuestra que el cierre funcione — no hay nada que cerrar — y por eso se dice"
  );
  console.log(
    "      en vez de contarlo como bueno. Cuando se aplique, esta línea debe pasar a CERRADO."
  );
}

// ---------------------------------------------------------------------------
// 3) El número no aparece en ninguna página pública
// ---------------------------------------------------------------------------

const PUBLICOS = [
  ...NUMEROS_PUBLICOS_DECLARADOS,
  ...(process.env.NIDO_NUMEROS_PUBLICOS ?? "").split(","),
  leerVariable("NEXT_PUBLIC_WHATSAPP_NUMBER"),
]
  .map((valor) => normalizarNumero((valor ?? "").trim()))
  .filter((valor) => valor.length === 10);

console.log(
  `\nNúmeros declarados como públicos (los únicos que pueden salir en una página): ${
    PUBLICOS.length ? PUBLICOS.join(", ") : "ninguno"
  }`
);

/** Una página de la superficie pública, con la dirección que el usuario visitaría. */
async function traerPagina(ruta) {
  try {
    const respuesta = await fetch(`${SITIO}${ruta}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
      headers: { "user-agent": "Nido-verificador/1.0 (+comprobacion-contacto-privado)" },
    });
    return { status: respuesta.status, html: await respuesta.text() };
  } catch (error) {
    return { status: 0, html: "", error: error.message };
  }
}

/** La dirección de una ficha real, para poder mirarla. Primero la base, después la portada. */
async function unSlugReal(htmlPortada) {
  const catalogo = await pedir("/rest/v1/pensiones?select=slug&activa=eq.true&limit=1");
  if (catalogo.status === 200) {
    try {
      const filas = JSON.parse(catalogo.texto);
      if (Array.isArray(filas) && filas[0]?.slug) return filas[0].slug;
    } catch {
      /* la respuesta no era una lista: se intenta por la portada */
    }
  }

  const enlace = htmlPortada?.match(/href="\/pensiones\/([^"?#]+)"/);
  return enlace?.[1] ?? null;
}

console.log("\nBuscando cualquier número ajeno en las páginas públicas:");

const portada = await traerPagina("/");
const sitemap = await traerPagina("/sitemap.xml");
const slug = await unSlugReal(portada.html);
const ficha = slug ? await traerPagina(`/pensiones/${slug}`) : null;

const PAGINAS = [
  ["la portada", "/", portada],
  ["la ficha del anuncio", slug ? `/pensiones/${slug}` : null, ficha],
  ["el sitemap", "/sitemap.xml", sitemap],
];

for (const [etiqueta, ruta, pagina] of PAGINAS) {
  if (!ruta) {
    avisos++;
    console.log(
      `NOTA  ${etiqueta}: OMITIDA — no hay ningún anuncio activo del que sacar una dirección.`
    );
    console.log(
      "      No se aprueba nada en su nombre: sin ficha que mirar, esta mitad no está medida."
    );
    continue;
  }

  if (!pagina || pagina.status !== 200) {
    problemas++;
    console.log(
      `FALLA ${etiqueta} (${ruta}): no se pudo descargar${pagina?.status ? ` (HTTP ${pagina.status})` : ""}.`
    );
    console.log(
      "      «No lo pude mirar» no es «no estaba»: esta mitad queda sin comprobar y el guion falla."
    );
    continue;
  }

  const encontrados = numerosAjenos(pagina.html, PUBLICOS);

  // Cuántas veces aparece el número público en ESTA página. Sin este dato, «0
  // ajenos» no distingue entre «la página no publica ningún teléfono» y «el
  // detector no encontró nada porque no había nada que encontrar». El segundo
  // caso es un verde que no prueba nada, y aquí se ve.
  const publicosVistos = contarPublicos(pagina.html, PUBLICOS);

  if (encontrados.length === 0) {
    console.log(
      `OK    ${etiqueta.padEnd(22)} ${String(pagina.html.length).padStart(7)} caracteres · 0 números ajenos` +
        (publicosVistos > 0
          ? ` · el público aparece ${publicosVistos} vez/veces (el detector está mirando)`
          : " · (en esta página no hay ningún teléfono publicado: el detector no se ejercita aquí)")
    );
    continue;
  }

  problemas++;
  console.log(`FALLA ${etiqueta} (${ruta}): ${encontrados.length} número(s) ajeno(s) en el HTML`);
  for (const numero of encontrados) {
    // Se imprime a propósito: está en una página pública, así que ya es público,
    // y sin el número el aviso no se puede ni comprobar ni corregir.
    console.log(`        └─ ${numero}`);
  }
}

// ---------------------------------------------------------------------------
// 4) El patrón del número es el mismo en la base y en el código
// ---------------------------------------------------------------------------

console.log("\nEl formato del número, en los dos sitios donde se decide:");

try {
  const migracion = readFileSync(join(RAIZ, ARCHIVO_MIGRACION), "utf8");
  const modulo = readFileSync(join(RAIZ, "lib/contacto-anfitrion.ts"), "utf8");

  const enLaBase = migracion.match(
    /contacto_anfitrion_whatsapp_formato[\s\S]*?check \(whatsapp ~ '([^']+)'\)/
  )?.[1];
  const enElCodigo = modulo.match(/PATRON_WHATSAPP\s*=\s*\/(.+)\/;/)?.[1];

  if (!enLaBase || !enElCodigo) {
    problemas++;
    console.log("FALLA  no se pudo leer el patrón en uno de los dos archivos.");
    console.log(`        └─ base: ${enLaBase ?? "no encontrado"} · código: ${enElCodigo ?? "no encontrado"}`);
  } else if (enLaBase !== enElCodigo) {
    problemas++;
    console.log("FALLA  el formato de la base y el del código NO coinciden.");
    console.log(`        └─ base:   ${enLaBase}`);
    console.log(`        └─ código: ${enElCodigo}`);
    console.log("           Una de las dos puertas acepta algo que la otra rechaza.");
  } else {
    console.log(`OK    base y código usan el mismo patrón  ${enLaBase}`);
  }
} catch (error) {
  problemas++;
  console.log(`FALLA  no se pudo comparar el patrón: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Veredicto
// ---------------------------------------------------------------------------

const expuesto = estados.some((e) => e.estado === "abierto");
const cerrado = estados.filter((e) => e.etiqueta.includes("contacto_anfitrion")).every((e) => e.estado === "cerrado");

console.log("\n" + "─".repeat(72));

if (expuesto) {
  console.log("VEREDICTO: EXPOSICIÓN ABIERTA — el número se puede leer sin sesión.");
  console.log("           Qué mirar: supabase/oleada-15-contacto-anfitrion-privado.sql,");
  console.log("           sección 3 (el `revoke` de `anon` y los privilegios por defecto de Supabase).");
  process.exit(1);
}

if (problemas > 0) {
  console.log(`VEREDICTO: NO SE PUDO COMPROBAR — ${problemas} comprobación(es) caída(s), ver arriba.`);
  console.log("           Ninguna de ellas se cuenta como cierre.");
  process.exit(1);
}

if (cerrado && avisos === 0) {
  console.log("VEREDICTO: CERRADO — el número no es alcanzable sin sesión y no aparece en");
  console.log("           ninguna página pública de las tres miradas.");
  console.log("           Falta la otra mitad, que necesita una sesión: la prueba funcional de");
  console.log("           RLS al final de oleada-15 (que un anfitrión no vea el número de otro).");
  process.exit(0);
}

if (cerrado) {
  console.log("VEREDICTO: CERRADO Y SIN FUGAS EN LO MEDIDO — pero hay partes omitidas (ver NOTA).");
  console.log("           La tabla existe y `anon` no la alcanza: eso SÍ está comprobado.");
  process.exit(0);
}

console.log("VEREDICTO: SIN APLICAR — la tabla privada todavía no existe.");
console.log("           Hoy no hay fuga porque no hay nada que fugarse, que no es lo mismo que");
console.log("           estar cerrado. Cuando se aplique la migración, esta línea debe decir CERRADO.");
process.exit(0);
