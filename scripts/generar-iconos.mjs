/**
 * Genera el set de íconos de la app (PWA + favicon) a partir del logo del
 * cliente (public/marca/roomieya-logo.jpg).
 *
 * El logo contiene dos bandas: el símbolo (casa + check) y el wordmark
 * ("RoomieYA"). Para los íconos se usa SOLO el símbolo, porque a 192 px el
 * texto es ilegible y los íconos maskable de Android recortarían las orillas.
 *
 * Uso: node scripts/generar-iconos.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAIZ = process.cwd();
const ORIGEN = path.join(RAIZ, "public", "marca", "roomieya-logo.jpg");
const SALIDA_ICONOS = path.join(RAIZ, "public", "iconos");
const SALIDA_MARCA = path.join(RAIZ, "public", "marca");
const BLANCO = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENTE = { r: 255, g: 255, b: 255, alpha: 0 };

await mkdir(SALIDA_ICONOS, { recursive: true });

/** Recorta los márgenes blancos y devuelve el buffer PNG + dimensiones. */
async function recortar(entrada) {
  const { data, info } = await sharp(entrada).trim({ threshold: 12 }).png().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Devuelve las bandas horizontales con contenido (para separar símbolo y texto). */
async function detectarBandas(buffer, ancho, alto) {
  const { data, info } = await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  const umbral = Math.max(2, Math.round(ancho * 0.003));
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
  return bandas;
}

const lockup = await recortar(ORIGEN);
const bandas = await detectarBandas(lockup.data, lockup.width, lockup.height);
console.log(`Logo sin márgenes: ${lockup.width}x${lockup.height} · bandas: ${bandas.map((b) => `${b.desde}-${b.hasta}`).join(", ")}`);

// Símbolo = banda superior (si hay varias). Si solo hay una, se usa completa.
const bandaSimbolo = bandas.length > 1 ? bandas[0] : { desde: 0, hasta: lockup.height - 1, alto: lockup.height };
const simbolo = await sharp(lockup.data)
  .extract({ left: 0, top: bandaSimbolo.desde, width: lockup.width, height: bandaSimbolo.alto })
  .trim({ threshold: 12 })
  .png()
  .toBuffer({ resolveWithObject: true });

console.log(`Símbolo extraído: ${simbolo.info.width}x${simbolo.info.height} (relación ${(simbolo.info.width / simbolo.info.height).toFixed(2)})`);

// Activos de marca reutilizables (lockup completo + símbolo suelto).
// PNG con paleta: al ser line art de pocos colores, pesa una fracción del PNG normal.
const OPCIONES_PNG_MARCA = { palette: true, quality: 92, compressionLevel: 9 };
const lockupPng = await sharp(lockup.data).png(OPCIONES_PNG_MARCA).toFile(path.join(SALIDA_MARCA, "roomieya-logo.png"));
const simboloPng = await sharp(simbolo.data).png(OPCIONES_PNG_MARCA).toFile(path.join(SALIDA_MARCA, "roomieya-simbolo.png"));
console.log(`OK roomieya-logo.png ${lockupPng.width}x${lockupPng.height} (${(lockupPng.size / 1024).toFixed(1)} KB)`);
console.log(`OK roomieya-simbolo.png ${simboloPng.width}x${simboloPng.height} (${(simboloPng.size / 1024).toFixed(1)} KB)`);

/**
 * Compone el símbolo centrado sobre un lienzo blanco.
 * @param {number} tamano  lado del ícono en px
 * @param {number} cobertura fracción del lienzo que ocupa el símbolo (0-1)
 */
async function componerIcono(tamano, cobertura, destino) {
  const caja = Math.round(tamano * cobertura);
  const contenido = await sharp(simbolo.data)
    .resize(caja, caja, { fit: "contain", background: TRANSPARENTE })
    .png()
    .toBuffer();
  const margen = Math.round((tamano - caja) / 2);
  const info = await sharp({ create: { width: tamano, height: tamano, channels: 4, background: BLANCO } })
    .composite([{ input: contenido, top: margen, left: margen }])
    .png({ compressionLevel: 9 })
    .toFile(destino);
  return `${path.basename(destino)} ${info.width}x${info.height} (${(info.size / 1024).toFixed(1)} KB)`;
}

// Coberturas: maskable deja el símbolo dentro del 80 % seguro de Android
// (0.55 => diagonal ~0.78 del lienzo, sin riesgo de recorte).
const trabajos = [
  [192, 0.68, "icon-192.png"],
  [512, 0.68, "icon-512.png"],
  [512, 0.55, "icon-maskable-512.png"],
  [180, 0.74, "apple-touch-icon.png"],
  [48, 0.88, "favicon-48.png"],
  [32, 0.9, "favicon-32.png"],
];

for (const [tamano, cobertura, archivo] of trabajos) {
  const resumen = await componerIcono(tamano, cobertura, path.join(SALIDA_ICONOS, archivo));
  console.log(`OK ${resumen}`);
}

console.log("Listo. Los favicons PNG se declaran en app/layout.tsx (metadata.icons).");
