// Comprobaciones HTTP del criterio (d) sobre el sitio CONSTRUIDO (next start).
// Guardián de identidad: si el servidor del puerto no es Nido, aborta.

const BASE = "http://localhost:3312";

async function pedir(ruta, opciones = {}) {
  const r = await fetch(BASE + ruta, { redirect: "manual", ...opciones });
  return { status: r.status, location: r.headers.get("location"), cuerpo: await r.text() };
}

const portada = await pedir("/");
const esNido =
  portada.cuerpo.includes("Nido") &&
  portada.cuerpo.includes("Universidad del Magdalena");
console.log(`GUARDIAN DE IDENTIDAD (Nido + Universidad del Magdalena): ${esNido}`);
if (!esNido) {
  console.log("ABORTADO: el puerto 3312 no sirve Nido.");
  process.exit(2);
}

const ficha = await pedir("/pensiones/residencia-makia");
console.log(`GET /pensiones/residencia-makia          ${ficha.status}`);
console.log(`  mapa presente (leaflet-container):    ${ficha.cuerpo.includes("leaflet-container")}`);
console.log(`  URL de teselas {s}:                   ${ficha.cuerpo.includes("tile.openstreetmap.org")}`);

const sw = await pedir("/sw.js");
const cspSW = sw.cuerpo.match(/connect-src[^\n]*/);
console.log(`GET /sw.js                              ${sw.status}`);
console.log(`  CSP del propio sw.js -> connect-src:  ${cspSW ? cspSW[0] : "no declarado en el cuerpo"}`);
console.log(`  cabecera CSP de /sw.js:               ${(await fetch(BASE + "/sw.js")).headers.get("content-security-policy")}`);
console.log(`  la condicion nueva esta en el archivo servido: ${sw.cuerpo.includes('url.origin === self.location.origin') && sw.cuerpo.includes('solicitud.destination === "image"')}`);

const signout = await fetch(BASE + "/auth/signout", { method: "POST", redirect: "manual" });
console.log(`POST /auth/signout                      ${signout.status} -> ${signout.headers.get("location")}`);

const publicar = await pedir("/publicar");
console.log(`GET /publicar                           ${publicar.status} -> ${publicar.location}`);
