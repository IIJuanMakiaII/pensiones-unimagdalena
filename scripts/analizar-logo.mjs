/**
 * Análisis del logo del cliente (para definir el recorte del ícono de la app).
 * Uso: node scripts/analizar-logo.mjs [ruta]
 */
import sharp from "sharp";

const origen = process.argv[2] ?? "public/marca/roomieya-logo.jpg";

const meta = await sharp(origen).metadata();
console.log(`Imagen: ${meta.width}x${meta.height} · formato ${meta.format}`);

// 1) Recorte de márgenes blancos
const recorte = await sharp(origen).trim({ threshold: 12 }).png().toBuffer({ resolveWithObject: true });
const { width, height } = recorte.info;
console.log(`Sin márgenes: ${width}x${height} (relación ${(width / height).toFixed(3)})`);

// 2) Bandas horizontales con contenido (separa símbolo de texto)
const { data, info } = await sharp(recorte.data).greyscale().raw().toBuffer({ resolveWithObject: true });
const umbral = Math.max(2, Math.round(info.width * 0.003));
const bandas = [];
let inicio = -1;
for (let y = 0; y < info.height; y++) {
  let tinta = 0;
  for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] < 245) tinta++;
  }
  const conContenido = tinta >= umbral;
  if (conContenido && inicio === -1) inicio = y;
  if (!conContenido && inicio !== -1) {
    bandas.push({ desde: inicio, hasta: y - 1, alto: y - inicio });
    inicio = -1;
  }
}
if (inicio !== -1) bandas.push({ desde: inicio, hasta: info.height - 1, alto: info.height - inicio });
console.log(`Bandas con contenido (${bandas.length}):`);
for (const b of bandas) console.log(`   y ${b.desde}–${b.hasta} (alto ${b.alto})`);

// 3) Colores dominantes (cuantizados, sin contar el blanco)
const { data: rgb, info: infoRgb } = await sharp(recorte.data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const conteo = new Map();
for (let i = 0; i < rgb.length; i += 3) {
  const r = rgb[i];
  const g = rgb[i + 1];
  const b = rgb[i + 2];
  if (r > 240 && g > 240 && b > 240) continue; // ignora blanco
  const clave = [r, g, b].map((c) => Math.round(c / 16) * 16).join(",");
  conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
}
const total = [...conteo.values()].reduce((a, b) => a + b, 0);
const top = [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log("Colores dominantes (sin blanco):");
for (const [clave, n] of top) {
  const [r, g, b] = clave.split(",").map(Number);
  const hex = "#" + [r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, "0")).join("").toUpperCase();
  console.log(`   ${hex}  ${((n / total) * 100).toFixed(1)}% del área con color`);
}
console.log(`Píxeles totales analizados: ${infoRgb.width}x${infoRgb.height}`);
