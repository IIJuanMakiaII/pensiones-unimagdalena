/**
 * ¿Puede un visitante sin sesión leer el teléfono del propietario? (tarea #47)
 *
 * Comprobación de SOLO LECTURA. No escribe una sola fila y no necesita
 * credenciales privilegiadas: usa exactamente la misma clave pública que viaja
 * al navegador, que es justo el punto de vista del atacante — quien consulte la
 * API directamente no pasa por la aplicación, así que la mitigación que vive en
 * `lib/supabase/mapeo.ts` no le afecta.
 *
 * Sirve ANTES y DESPUÉS de aplicar `supabase/oleada-10-cerrar-whatsapp.sql`:
 *
 *   antes   → «EXPOSICIÓN ABIERTA» y reproduce el 200 que reportó la auditoría;
 *   después → «CERRADO», con el catálogo y la ficha respondiendo igual que hoy.
 *
 * Qué comprueba
 *   1. El catálogo público sigue vivo (y no trae la columna del teléfono).
 *   2. La ficha sigue resolviéndose por su dirección legible.
 *   3. `whatsapp` — legible sin sesión o no.
 *   4. `autorizacion_contacto_en` — ídem.
 *   5. El comodín `select=*`, que es el marcador que la auditoría usó.
 *
 * Lo que NO comprueba, y se dice en vez de taparse
 *   · La gestión real del propietario —leer y editar sus anuncios con una
 *     sesión— necesita las credenciales de una cuenta. Aquí se comprueba la
 *     mitad demostrable sin sesión: que las columnas que lee el panel siguen
 *     legibles. La otra mitad —los privilegios de escritura del rol con
 *     sesión— se mide con las consultas `has_column_privilege` que están al
 *     final de oleada-10-cerrar-whatsapp.sql.
 *   · Nada de escritura: ni un `PATCH` ni un `POST`.
 *
 * Uso:    npm run verificar:exposicion-propietario
 * Salida: 0 = el teléfono está cerrado y el catálogo responde
 *         1 = expuesto, roto, o no se pudo comprobar
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Lo privado que esta comprobación vigila, con su nombre en lenguaje llano. */
const COLUMNAS_PRIVADAS = [
  ["whatsapp", "teléfono del propietario"],
  ["autorizacion_contacto_en", "fecha en que autorizó publicarlo"],
];

/**
 * Las columnas del catálogo, leídas del propio código en vez de copiadas.
 *
 * Copiar aquí los 18 nombres crearía dos listas que se separan solas: el día que
 * se añada una columna al mapeo, esta comprobación seguiría midiendo la lista
 * vieja sin avisar, y un verificador desactualizado es peor que no tenerlo. Se
 * lee `lib/supabase/mapeo.ts`; si su forma cambiara, esto **falla en voz alta**
 * en lugar de medir contra una lista vacía.
 */
function columnasDelCatalogo() {
  const fuente = readFileSync(join(RAIZ, "lib/supabase/mapeo.ts"), "utf8");
  const bloque = fuente.match(/COLUMNAS_PENSION\s*=\s*\[([\s\S]*?)\]\s*\.join/);

  if (!bloque) {
    throw new Error(
      "No se pudo leer COLUMNAS_PENSION de lib/supabase/mapeo.ts. " +
        "Si cambió su forma, actualiza esta comprobación."
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

/** Del `.env.local` del proyecto, o del entorno si ya viene exportado. */
function leerVariable(nombre) {
  if (process.env[nombre]) return process.env[nombre].trim();

  const env = readFileSync(join(RAIZ, ".env.local"), "utf8");
  const coincidencia = env.match(new RegExp(`^\\s*${nombre}\\s*=\\s*(.*)$`, "m"));
  return (coincidencia?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const URL_BASE = leerVariable("NEXT_PUBLIC_SUPABASE_URL");
const CLAVE = leerVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!URL_BASE || !CLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

/** Una consulta de solo lectura. Devuelve el estado y las filas, o el motivo del fallo. */
async function pedir(ruta, extra = {}) {
  try {
    const respuesta = await fetch(`${URL_BASE}${ruta}`, {
      headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, ...extra },
    });
    const cuerpo = await respuesta.text();

    let filas = null;
    try {
      const datos = JSON.parse(cuerpo);
      if (Array.isArray(datos)) filas = datos;
    } catch {
      /* respuesta no JSON: un error de la API, o una página de error */
    }

    return {
      status: respuesta.status,
      filas,
      rango: respuesta.headers.get("content-range"),
      texto: cuerpo,
    };
  } catch (error) {
    return { status: 0, filas: null, rango: null, texto: error.message };
  }
}

/**
 * 200 = se puede leer. 401/403 = la API lo niega (PostgREST responde 403 con
 * `42501` cuando falta el privilegio de la columna). Cualquier otra cosa —404,
 * 400, 500, o un fallo de red— es «no se pudo comprobar», y eso NO se cuenta
 * como cierre: confundir «no lo sé» con «está cerrado» es exactamente el error
 * que deja una puerta abierta creyéndola cerrada.
 */
function estadoDe(status, texto) {
  if (status === 200 || status === 206) return "abierto";
  if (status === 401 || status === 403) return "cerrado";
  // Falta el privilegio de una columna: PostgreSQL lo llama 42501. Se reconoce
  // por el cuerpo además del estado para no depender de con qué número lo
  // devuelva la versión del servicio — lo que importa es si negó el acceso.
  if (/42501|permission denied for column|insufficient_privilege/i.test(texto ?? "")) {
    return "cerrado";
  }
  return "indeterminado";
}

const columnas = columnasDelCatalogo();
const proyeccion = columnas.join(",");

console.log(`Proyecto:  ${URL_BASE}`);
console.log(`Clave:     pública (anon), la misma que viaja al navegador`);
console.log(`Catálogo:  ${columnas.length} columnas, leídas de lib/supabase/mapeo.ts\n`);

let problemas = 0;

// ---------------------------------------------------------------------------
// 1) El catálogo público sigue vivo
// ---------------------------------------------------------------------------
const catalogo = await pedir(`/rest/v1/pensiones?select=${proyeccion}&activa=eq.true&limit=5`);
const catalogoLegible = catalogo.status === 200 && Array.isArray(catalogo.filas);

console.log(
  `${catalogoLegible ? "OK    " : "FALLA "} catálogo público      HTTP ${catalogo.status} · anuncios activos leídos: ${
    catalogo.filas ? catalogo.filas.length : "n/d"
  }`
);

if (!catalogoLegible) {
  problemas++;
  if (catalogo.status !== 200) {
    console.log(`        └─ ${catalogo.texto.slice(0, 200)}`);
  }
}

// Que la proyección no se haya ampliado por descuido: si el teléfono viajara en
// la consulta del catálogo, esto lo diría antes de que llegue al navegador.
const fugaEnLaConsulta = catalogo.filas?.some((fila) =>
  COLUMNAS_PRIVADAS.some(([columna]) => columna in fila)
);
if (fugaEnLaConsulta) {
  problemas++;
  console.log("FALLA  el catálogo trae la columna del teléfono: la proyección se amplió sin querer");
}

// ---------------------------------------------------------------------------
// 2) La ficha sigue resolviéndose por su dirección legible
// ---------------------------------------------------------------------------
const identificador = catalogo.filas?.[0]?.slug ?? catalogo.filas?.[0]?.id;

if (!identificador) {
  console.log("AVISO  sin anuncios activos: no se puede comprobar la ficha (no es un fallo del cierre)");
} else {
  const ficha = await pedir(
    `/rest/v1/pensiones?select=${proyeccion}&slug=eq.${encodeURIComponent(identificador)}&limit=1`
  );
  const fichaOk = ficha.status === 200 && (ficha.filas?.length ?? 0) === 1;

  if (!fichaOk) problemas++;

  console.log(
    `${fichaOk ? "OK    " : "FALLA "} ficha por dirección   HTTP ${ficha.status} · «${identificador}» resuelta: ${
      ficha.filas?.length ?? "n/d"
    }`
  );
}

// ---------------------------------------------------------------------------
// 3 y 4) Lo privado: ¿lo puede pedir alguien sin sesión?
// ---------------------------------------------------------------------------
const estados = [];

for (const [columna, descripcion] of COLUMNAS_PRIVADAS) {
  const lectura = await pedir(`/rest/v1/pensiones?select=${columna}&limit=1`);
  const estado = estadoDe(lectura.status, lectura.texto);
  estados.push({ columna, estado });

  const etiqueta = `${columna}  (${descripcion})`;
  console.log(
    `${estado === "cerrado" ? "OK    " : "FALLA "} ${etiqueta.padEnd(52)} HTTP ${lectura.status} · ${estado}`
  );

  // Solo si se puede leer: cuántas filas guardan un valor. Nunca se imprime el
  // valor — este verificador no debe sacar por pantalla un dato personal, ni
  // siquiera en un registro.
  if (estado === "abierto") {
    const conValor = await pedir(
      `/rest/v1/pensiones?select=${columna}&${columna}=not.is.null&limit=1`,
      { Prefer: "count=exact" }
    );
    const total = conValor.rango?.split("/")?.[1];
    console.log(
      `        └─ filas con un valor guardado: ${total ?? "n/d"} (el valor no se imprime)`
    );
  }

  if (estado === "indeterminado") {
    problemas++;
    // Se imprime lo que dijo la API para que la evidencia se explique sola y no
    // haya que volver a reproducir el caso: un veredicto sin motivo no sirve.
    console.log(`        └─ respuesta inesperada: ${lectura.texto.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// 5) El comodín: el marcador que usó la auditoría
// ---------------------------------------------------------------------------
const comodin = await pedir("/rest/v1/pensiones?select=*&limit=1");
const comodinEstado = estadoDe(comodin.status, comodin.texto);

console.log(
  `\n${comodinEstado === "cerrado" ? "OK    " : "FALLA "} comodín «select=*»      HTTP ${comodin.status} · ${comodinEstado}`
);
console.log(
  "        └─ con el cierre aplicado, un comodín falla con 42501 en vez de devolver todas las columnas"
);

if (comodinEstado === "indeterminado") problemas++;

// ---------------------------------------------------------------------------
// Veredicto
// ---------------------------------------------------------------------------
const expuesto = estados.some((e) => e.estado === "abierto") || comodinEstado === "abierto";
const cerrado = estados.every((e) => e.estado === "cerrado") && comodinEstado === "cerrado";

console.log("\n" + "─".repeat(72));

if (expuesto) {
  console.log("VEREDICTO: EXPOSICIÓN ABIERTA — la migración NO está aplicada.");
  console.log("           Un usuario sin sesión puede leer el teléfono del propietario.");
  console.log("           Qué ejecutar: supabase/oleada-10-cerrar-whatsapp.sql");
  console.log("           (la migración vigente supabase/oleada-9.sql ya da por hecho ese cierre).");
  console.log("           NO ejecutes supabase/oleada-9-descartada.sql: es un borrador sin aplicar.");
  process.exit(1);
}

if (cerrado && problemas === 0) {
  console.log("VEREDICTO: CERRADO — el teléfono no es legible sin sesión y el catálogo responde.");
  console.log("           Falta la otra mitad de la garantía, que necesita una sesión:");
  console.log("           las consultas has_column_privilege del final de oleada-10.");
  process.exit(0);
}

if (cerrado) {
  console.log("VEREDICTO: CERRADO, PERO CON COMPROBACIONES CAÍDAS (ver FALLA arriba).");
  process.exit(1);
}

console.log("VEREDICTO: NO SE PUDO COMPROBAR — hay respuestas que no son 200 ni 401/403.");
console.log("           Ninguna de esas respuestas se cuenta como cierre: «no lo sé» no es");
console.log("           «está cerrado».");
process.exit(1);
