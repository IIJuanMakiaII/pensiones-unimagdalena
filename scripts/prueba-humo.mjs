/**
 * Prueba de humo de las rutas del sitio.
 *
 * Uso:
 *   node scripts/prueba-humo.mjs                → contra un servidor ya levantado
 *   node scripts/prueba-humo.mjs --arrancar     → levanta el build de PRODUCCIÓN, prueba y lo apaga
 *   node scripts/prueba-humo.mjs --arrancar --dev → igual, pero con el servidor de desarrollo
 *
 * Comprueba el estado HTTP y que el contenido esperado aparezca en la respuesta.
 * Si el puerto 3000 ya está ocupado, reutiliza el servidor existente en lugar de
 * arrancar otro (dos servidores sobre la misma carpeta `.next` la corrompen).
 */
import { spawn } from "node:child_process";
import { setTimeout as esperar } from "node:timers/promises";

const BASE = "http://127.0.0.1:3000";
const arrancar = process.argv.includes("--arrancar");
const enDesarrollo = process.argv.includes("--dev");

/** [ruta, texto esperado en la respuesta (null = solo el estado HTTP)] */
const RUTAS = [
  ["/", "Unimagdalena"],
  ["/login?destino=%2Fpublicar", "Acceso anfitriones"],
  ["/login?destino=%2Fpublicar", "Acceso anfitriones"],
  ["/registro", "anfitri"],
  ["/publicar", null],
  ["/offline", "Sin conexión"],
  ["/manifest.webmanifest", "Pensiones UniMag"],
  ["/sw.js", "CACHE_APP"],
  ["/iconos/icon-192.png", null],
];

let proceso = null;

async function puertoOcupado() {
  try {
    const respuesta = await fetch(`${BASE}/`, { method: "HEAD" });
    return Boolean(respuesta.status);
  } catch {
    return false;
  }
}

async function esperarServidor(limiteMs) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    try {
      const respuesta = await fetch(`${BASE}/`, { method: "HEAD" });
      if (respuesta.status) return true;
    } catch {
      /* aún no escucha */
    }
    await esperar(1000);
  }
  return false;
}

function apagar() {
  if (!proceso) return;
  try {
    spawn("taskkill", ["/PID", String(proceso.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {
    proceso.kill();
  }
  proceso = null;
}

let fallos = 0;

if (arrancar) {
  if (await puertoOcupado()) {
    console.log("El puerto 3000 ya está en uso: se prueban las rutas contra ese servidor.\n");
  } else {
    const comando = enDesarrollo ? "npm run dev" : "npm start";
    console.log(`Levantando el servidor (${comando})...`);
    proceso = spawn(comando, { shell: true, stdio: ["ignore", "pipe", "pipe"] });

    let salida = "";
    proceso.stdout.on("data", (datos) => (salida += datos.toString()));
    proceso.stderr.on("data", (datos) => (salida += datos.toString()));
    process.on("exit", apagar);

    const listo = await esperarServidor(enDesarrollo ? 90000 : 45000);
    if (!listo) {
      console.log("El servidor no respondió a tiempo. Salida:\n" + salida.slice(-1500));
      apagar();
      process.exit(1);
    }
    console.log("Servidor listo.\n");
  }
}

console.log(`Prueba de humo contra ${BASE}\n`);
for (const [ruta, texto] of RUTAS) {
  const inicio = Date.now();
  try {
    const respuesta = await fetch(`${BASE}${ruta}`, { redirect: "manual" });
    const ms = Date.now() - inicio;
    const cuerpo = texto ? await respuesta.text() : "";
    const correcto = respuesta.status < 400 && (!texto || cuerpo.includes(texto));
    if (!correcto) fallos++;
    console.log(
      `  ${correcto ? "OK   " : "FALLA"} ${String(respuesta.status).padEnd(4)} ${ruta.padEnd(30)} ${String(ms).padStart(5)} ms${
        texto && !cuerpo.includes(texto) ? `  (no contiene "${texto}")` : ""
      }`
    );
  } catch (error) {
    fallos++;
    console.log(`  ERROR      ${ruta.padEnd(30)} ${error.message}`);
  }
}

apagar();
console.log(fallos === 0 ? "\nTodas las rutas responden correctamente." : `\n${fallos} ruta(s) con problemas.`);
process.exit(fallos === 0 ? 0 : 1);
