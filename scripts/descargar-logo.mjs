/**
 * Descarga el logo del cliente al proyecto.
 * Uso: node scripts/descargar-logo.mjs <url> <destino>
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.argv[2];
const destino = process.argv[3] ?? "public/marca/roomieya-logo.jpg";
if (!url) {
  console.error("Falta la URL");
  process.exit(1);
}

const respuesta = await fetch(url);
if (!respuesta.ok) {
  console.error(`HTTP ${respuesta.status} ${respuesta.statusText}`);
  process.exit(1);
}
const buffer = Buffer.from(await respuesta.arrayBuffer());
if (buffer.length < 1000) {
  console.error(`Archivo sospechosamente pequeño: ${buffer.length} bytes`);
  process.exit(1);
}
await mkdir(path.dirname(destino), { recursive: true });
await writeFile(destino, buffer);
console.log(`OK ${destino} (${(buffer.length / 1024).toFixed(1)} KB)`);
