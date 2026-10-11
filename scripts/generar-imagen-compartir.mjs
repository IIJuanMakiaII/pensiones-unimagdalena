/**
 * Genera la imagen de compartir (Open Graph / Twitter card) de Nido.
 *
 * Por qué existe: la tarjeta se servía desde `images.unsplash.com`, una foto de
 * stock de un tercero que el sitio no controla y que además solo fijaba el ancho,
 * así que no se garantizaba el 630 px que el propio HTML declaraba.
 *
 * Se compone aquí, en el repositorio, y el resultado queda versionado como
 * archivo estático en `public/marca/`. Así la imagen se sirve desde el propio
 * dominio, no depende de ninguna llamada externa en tiempo de petición y se puede
 * regenerar de forma reproducible.
 *
 * Uso: node scripts/generar-imagen-compartir.mjs
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ANCHO = 1200;
const ALTO = 630;
const ROSA = "#FF385C";
const TINTA = "#222222";
const TINTA_SUAVE = "#5B5B5B";

const LOGO = join("public", "marca", "nido-logo.png");
const SALIDA = join("public", "marca", "compartir-nido.png");

/**
 * Decide el fondo a partir de la **naturaleza del archivo del logo**, no de su brillo.
 *
 * La primera versión deducía «logo claro -> fondo rosa» y salió mal: este logo es
 * un rectángulo blanco opaco con el dibujo oscuro encima, así que su luminancia
 * media es alta aunque el dibujo sea oscuro. El resultado era un parche blanco de
 * bordes duros sobre el rosa.
 *
 * Lo que importa es si el logo tiene fondo transparente:
 *  - con transparencia real, es una marca recortada y se puede poner sobre color;
 *  - sin transparencia, es una placa opaca y el fondo de la tarjeta debe ser del
 *    mismo color que su fondo para que la unión no se note.
 */
async function analizarLogo(ruta) {
  const { data, info } = await sharp(ruta).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const canales = info.channels;
  let opacos = 0;
  let suma = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += canales) {
    total++;
    const alfa = canales === 4 ? data[i + 3] : 255;
    if (alfa < 40) continue;
    opacos++;
    suma += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return {
    proporcionTransparente: total === 0 ? 0 : 1 - opacos / total,
    luminancia: opacos === 0 ? 255 : suma / opacos,
  };
}

const analisis = await analizarLogo(LOGO);
// Por debajo de un 20 % de transparencia, el logo es una placa opaca.
const esMarcaRecortada = analisis.proporcionTransparente > 0.2;
const fondo = esMarcaRecortada ? (analisis.luminancia > 165 ? ROSA : "#FFFFFF") : "#FFFFFF";
const colorTexto = fondo === ROSA ? "#FFFFFF" : TINTA;
const colorTextoSuave = fondo === ROSA ? "#FFE3EA" : TINTA_SUAVE;

console.log(`  logo: ${(analisis.proporcionTransparente * 100).toFixed(1)} % de transparencia, luminancia ${analisis.luminancia.toFixed(1)}`);
console.log(`  tipo de logo: ${esMarcaRecortada ? "marca recortada (fondo transparente)" : "placa opaca (sin transparencia)"}`);
console.log(`  fondo elegido: ${fondo}`);

const fondoDecorado = `<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${ANCHO}" height="${ALTO}" fill="${fondo}"/>
  <rect x="0" y="0" width="${ANCHO}" height="12" fill="${ROSA}"/>
  <text x="${ANCHO / 2}" y="470" text-anchor="middle"
        font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"
        font-size="46" font-weight="700" fill="${colorTexto}">Habitaciones verificadas a minutos del campus</text>
  <text x="${ANCHO / 2}" y="530" text-anchor="middle"
        font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"
        font-size="30" fill="${colorTextoSuave}">Santa Marta, Magdalena &#183; Universidad del Magdalena</text>
</svg>`;

const logoAjustado = await sharp(LOGO)
  .resize({ width: 620, height: 230, fit: "inside", withoutEnlargement: false })
  .png()
  .toBuffer();
const { width: anchoLogo, height: altoLogo } = await sharp(logoAjustado).metadata();

const marca = `<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${ANCHO}" height="${ALTO}" fill="${ROSA}"/>
</svg>`;

await mkdir(dirname(SALIDA), { recursive: true });

try {
  await sharp(Buffer.from(fondoDecorado, "utf8"))
    .composite([
      {
        input: logoAjustado,
        top: Math.round(150 + (230 - altoLogo) / 2),
        left: Math.round((ANCHO - anchoLogo) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(SALIDA);
  console.log(`  escrito: ${SALIDA}`);
} catch (error) {
  console.error(`  el motor SVG no pudo componer la imagen: ${error.message}`);
  console.error(`  (si falta soporte SVG en sharp, se genera con el navegador)`);
  // Deja al menos una base válida para que el archivo exista.
  await sharp(Buffer.from(marca, "utf8")).png().toFile(SALIDA);
  process.exitCode = 1;
}

const salida = await sharp(SALIDA).metadata();
const bytes = (await sharp(SALIDA).toBuffer()).length;
console.log(`  resultado: ${salida.width}x${salida.height}  ${salida.format}  ${Math.round(bytes / 1024)} KB`);

/**
 * Las dimensiones no son un adorno: el `alt`, el `width` y el `height` que
 * declara el HTML tienen que coincidir con el archivo real, o la tarjeta se
 * recorta al compartirla. Si no cuadran, este comando falla.
 */
if (salida.width !== ANCHO || salida.height !== ALTO) {
  console.error(`  ALTO: se esperaba ${ANCHO}x${ALTO} y salió ${salida.width}x${salida.height}`);
  process.exitCode = 1;
}
