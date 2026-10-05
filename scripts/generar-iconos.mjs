/**
 * Genera el set de íconos de la app (PWA + favicon) a partir de nido.png.
 * Para los íconos se usa SOLO el isotipo, porque el wordmark no es legible a
 * 192 px y los íconos maskable de Android recortarían las orillas.
 *
 * Uso: node scripts/generar-iconos.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAIZ = process.cwd();
const ORIGEN = path.join(RAIZ, "nido.png");
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

const lockup = await recortar(ORIGEN);
console.log(`Logo sin márgenes: ${lockup.width}x${lockup.height}`);

// El isotipo es el bloque cuadrado a la izquierda del wordmark horizontal.
const ladoSimbolo = Math.min(lockup.height, lockup.width);
const simbolo = await sharp(lockup.data)
  .extract({ left: 0, top: 0, width: ladoSimbolo, height: ladoSimbolo })
  .trim({ threshold: 12 })
  .png()
  .toBuffer({ resolveWithObject: true });

console.log(`Símbolo extraído: ${simbolo.info.width}x${simbolo.info.height} (relación ${(simbolo.info.width / simbolo.info.height).toFixed(2)})`);

// Activos de marca reutilizables (lockup completo + símbolo suelto).
// PNG con paleta: al ser line art de pocos colores, pesa una fracción del PNG normal.
const OPCIONES_PNG_MARCA = { palette: true, quality: 92, compressionLevel: 9 };
const lockupPng = await sharp(lockup.data).png(OPCIONES_PNG_MARCA).toFile(path.join(SALIDA_MARCA, "nido-logo.png"));
const simboloPng = await sharp(simbolo.data).png(OPCIONES_PNG_MARCA).toFile(path.join(SALIDA_MARCA, "nido-simbolo.png"));
console.log(`OK nido-logo.png ${lockupPng.width}x${lockupPng.height} (${(lockupPng.size / 1024).toFixed(1)} KB)`);
console.log(`OK nido-simbolo.png ${simboloPng.width}x${simboloPng.height} (${(simboloPng.size / 1024).toFixed(1)} KB)`);

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
