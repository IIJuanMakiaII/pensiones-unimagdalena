/**
 * Guardián de credenciales: impide que un secreto entre al repositorio.
 *
 * Se ejecuta en cada subida (integración continua) y también a mano:
 *
 *   node scripts/verificar-secretos.mjs
 *
 * Qué comprueba, sobre los archivos que git rastrea de verdad (no sobre el disco,
 * que incluiría `node_modules` y `.next`):
 *
 *  1. Que ningún archivo de entorno (`.env`, `.env.local`, …) esté versionado.
 *  2. Que ningún archivo contenga un patrón de credencial real: clave privada
 *     PEM, `service_role`, JWT con pinta de clave de Supabase, claves de AWS,
 *     tokens de proveedor.
 *  3. Que `.gitignore` siga cubriendo lo que debe (`.env*.local`, `.next/`,
 *     `node_modules`, `tmp/`): si alguien lo afloja, esta comprobación lo dice.
 *
 * Sale con código 1 si encuentra algo: en integración continua eso detiene la
 * subida. Un secreto comprometido no se arregla borrándolo después — hay que
 * rotarlo —, así que la única defensa barata es no dejarlo entrar.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Patrones de credencial. Se documenta cada uno: ninguno es decorativo. */
const PATRONES = [
  ["clave privada PEM", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  [
    "clave de servicio de Supabase asignada a una variable",
    /(SUPABASE_)?SERVICE_ROLE(_KEY)?\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}/i,
  ],
  [
    "JWT con pinta de clave de Supabase (anónima o de servicio)",
    /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\./,
  ],
  ["clave secreta de Supabase (nuevo formato)", /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ["token personal de Supabase", /\bsbp_[A-Za-z0-9]{20,}/],
  ["clave de acceso de AWS", /\bAKIA[0-9A-Z]{16}\b/],
  [
    "contraseña o token con valor literal largo",
    /(password|passwd|contrasena|contraseña|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"'\s]{24,}["']/i,
  ],
];

/**
 * Marcadores de posición: no son credenciales aunque la línea se les parezca.
 * Sin esta lista, la propia documentación que explica qué pegar dispararía el
 * aviso, y una alarma con falsos positivos deja de mirarse.
 */
const MARCADORES = /(tu-|<|\.\.\.|xxxx|PENDIENTE|pendiente|ejemplo|example|marcador|placeholder|no-aplica|ninguna)/i;

/** Archivos de entorno que nunca deben versionarse (el de ejemplo sí). */
const ENTORNO_PROHIBIDO = /(^|\/)\.env($|\.)/;
const ENTORNO_PERMITIDO = /\.env\.example$/;

/** Lo que `.gitignore` debe seguir ignorando. */
const DEBE_IGNORAR = [".env*.local", ".next/", "node_modules", "tmp/"];

/** Directorios que nunca se analizan (y que `.gitignore` ya excluye). */
const EXCLUIDOS = new Set(["node_modules", ".next", ".git", "tmp", ".tmp-prueba", "out", "build"]);

/** Entradas de entorno locales: no se versionan, así que no se señalan. */
const ENTORNO_LOCAL = /(^|\/)\.env(\..+)?$/;

/**
 * Si no hay git, se recorre el disco con las mismas exclusiones que `.gitignore`.
 * Una comprobación de seguridad que se rinde cuando falta una herramienta deja
 * de proteger: es preferible analizar de más (avisando de que el modo no es
 * exacto) que no analizar.
 */
function recorrerDirectorio(directorio, prefijo = "") {
  const encontrados = [];
  let entradas;
  try {
    entradas = readdirSync(directorio, { withFileTypes: true });
  } catch {
    return encontrados;
  }

  for (const entrada of entradas) {
    const relativo = prefijo ? `${prefijo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) {
      if (EXCLUIDOS.has(entrada.name)) continue;
      encontrados.push(...recorrerDirectorio(path.join(directorio, entrada.name), relativo));
    } else if (entrada.isFile()) {
      if (ENTORNO_LOCAL.test(relativo)) continue;
      encontrados.push(relativo);
    }
  }

  return encontrados;
}

function archivosVersionados() {
  try {
    const salida = execFileSync("git", ["ls-files", "-z"], {
      cwd: RAIZ,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return { modo: "git (solo archivos versionados)", archivos: salida.split("\0").filter(Boolean) };
  } catch (error) {
    const motivo = String(error.message).split("\n")[0];
    console.log(
      `Aviso: git no está disponible (${motivo}).\n` +
        "       Se analiza el contenido del proyecto omitiendo lo que .gitignore excluye.\n" +
        "       La comprobación «archivo de entorno versionado» solo es exacta con git."
    );
    return {
      modo: "recorrido del disco (git no disponible): puede incluir archivos no versionados",
      archivos: recorrerDirectorio(RAIZ),
    };
  }
}

function esBinario(ruta) {
  return /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|pdf|zip)$/i.test(ruta);
}

const hallazgos = [];
const { modo, archivos } = archivosVersionados();

// 1. Archivos de entorno versionados.
for (const archivo of archivos) {
  if (ENTORNO_PERMITIDO.test(archivo)) continue;
  if (ENTORNO_PROHIBIDO.test(archivo)) {
    hallazgos.push({ archivo, motivo: "archivo de entorno versionado", linea: "" });
  }
}

// 2. Contenido con pinta de credencial.
for (const archivo of archivos) {
  if (esBinario(archivo)) continue;

  let contenido;
  try {
    contenido = readFileSync(path.join(RAIZ, archivo), "utf8");
  } catch {
    continue; // Archivo borrado del disco pero aún en el índice.
  }

  const lineas = contenido.split("\n");
  for (const [nombre, patron] of PATRONES) {
    lineas.forEach((linea, indice) => {
      if (!patron.test(linea)) return;
      // El propio guardián contiene los patrones: no se señala a sí mismo.
      if (archivo === "scripts/verificar-secretos.mjs") return;
      // Documentación que explica qué pegar, no una credencial pegada.
      if (MARCADORES.test(linea)) return;
      hallazgos.push({
        archivo,
        motivo: nombre,
        linea: `${indice + 1}: ${linea.trim().slice(0, 120)}`,
      });
    });
  }
}

// 3. `.gitignore` sigue cubriendo lo que debe.
let gitignore = "";
try {
  gitignore = readFileSync(path.join(RAIZ, ".gitignore"), "utf8");
} catch {
  hallazgos.push({ archivo: ".gitignore", motivo: "no existe", linea: "" });
}

for (const regla of DEBE_IGNORAR) {
  if (gitignore && !gitignore.includes(regla)) {
    hallazgos.push({
      archivo: ".gitignore",
      motivo: `ya no ignora «${regla}»`,
      linea: "",
    });
  }
}

// --- Informe ---------------------------------------------------------------

console.log(`Archivos analizados: ${archivos.length}  (${modo})`);
console.log(`Patrones de credencial aplicados: ${PATRONES.length}\n`);

if (hallazgos.length === 0) {
  console.log("OK  sin credenciales versionadas ni archivos de entorno en el repositorio");
  console.log(`OK  .gitignore cubre: ${DEBE_IGNORAR.join(", ")}`);
  process.exit(0);
}

console.error(`FALLO  ${hallazgos.length} hallazgo(s):\n`);
for (const { archivo, motivo, linea } of hallazgos) {
  console.error(`  ${archivo}  →  ${motivo}`);
  if (linea) console.error(`      ${linea}`);
}

console.error(
  "\nUn secreto que ya entró al repositorio NO se arregla borrándolo: " +
    "hay que rotarlo (cambiar la clave en el proveedor) y después limpiar el historial."
);
process.exit(1);
