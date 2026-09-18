/**
 * Auditoría de exposición REST de Supabase.
 *
 * Comprueba, usando la MISMA clave pública que va al navegador, que:
 *  - el catálogo público (pensiones y habitaciones) sea legible;
 *  - las tablas sensibles (usuarios) NO devuelvan ninguna fila a un anónimo,
 *    es decir, que las políticas RLS realmente protejan los datos.
 *
 * Es la comprobación que exige el flujo del equipo antes de declarar un
 * backend listo para producción.
 *
 * Uso: node scripts/verificar-supabase.mjs
 */
import { readFile } from "node:fs/promises";

const env = await readFile(".env.local", "utf8").catch(() => "");

function leerVariable(nombre) {
  const coincidencia = env.match(new RegExp(`^${nombre}=(.*)$`, "m"));
  return (coincidencia?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

const URL_BASE = leerVariable("NEXT_PUBLIC_SUPABASE_URL");
const CLAVE = leerVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!URL_BASE || !CLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

/** [tabla, comportamiento esperado, descripción] */
const CASOS = [
  ["pensiones", "legible", "catálogo público (solo anuncios activos)"],
  ["habitaciones", "legible", "habitaciones de anuncios activos"],
  ["usuarios", "bloqueado", "perfiles: un visitante anónimo no debe ver NINGUNA fila"],
];

let fallos = 0;
console.log(`Proyecto: ${URL_BASE}\n`);

for (const [tabla, esperado, nota] of CASOS) {
  const url = `${URL_BASE}/rest/v1/${tabla}?select=*&limit=1`;
  try {
    const respuesta = await fetch(url, {
      headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` },
    });

    const cuerpo = await respuesta.text();
    let filas = null;
    try {
      const datos = JSON.parse(cuerpo);
      if (Array.isArray(datos)) filas = datos.length;
    } catch {
      /* respuesta no JSON (error de API): se evalúa por el código de estado */
    }

    const ok =
      esperado === "legible"
        ? respuesta.ok
        : !respuesta.ok || filas === 0;

    if (!ok) fallos++;

    const detalle =
      esperado === "legible"
        ? `HTTP ${respuesta.status} · filas: ${filas ?? "n/d"}`
        : `HTTP ${respuesta.status} · filas expuestas: ${filas ?? 0}`;

    console.log(`${ok ? "OK   " : "FALLA"} ${tabla.padEnd(14)} ${detalle.padEnd(34)} ${nota}`);
  } catch (error) {
    fallos++;
    console.log(`ERROR ${tabla.padEnd(14)} ${error.message}`);
  }
}

console.log(
  fallos === 0
    ? "\nRLS correcto: el catálogo es público y los perfiles NO son legibles por anónimos."
    : `\n${fallos} comprobación(es) con problemas: revisa las políticas RLS.`
);
process.exit(fallos === 0 ? 0 : 1);
