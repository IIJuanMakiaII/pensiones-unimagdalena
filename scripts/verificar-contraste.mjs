/**
 * Verificación de contraste WCAG 2.1 (Agente 3 — QA de accesibilidad).
 *
 * Lee la paleta real desde tailwind.config.ts y comprueba las combinaciones
 * texto/fondo que la interfaz usa de verdad. Umbrales:
 *   - Texto normal (< 18.66 px negrita): AA = 4.5:1
 *   - Texto grande (>= 24 px o >= 18.66 px negrita): AA = 3:1
 *   - Gráficos e iconos portadores de información (1.4.11): 3:1
 *
 * Uso: node scripts/verificar-contraste.mjs
 */
import { readFile } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const config = await readFile("tailwind.config.ts", "utf8");

/** Extrae los pares clave: "#hex" de un bloque simple (sin llaves anidadas). */
function extraerEscala(nombre) {
  const bloque = config.match(new RegExp(`${nombre}\\s*:\\s*\\{([^}]*)\\}`, "s"));
  if (!bloque) throw new Error(`No se encontró la escala "${nombre}" en tailwind.config.ts`);
  const pares = {};
  for (const linea of bloque[1].split(",")) {
    const m = linea.match(/^\s*"?([\w-]+)"?\s*:\s*"(#[0-9A-Fa-f]{6})"/);
    if (m) pares[m[1]] = m[2];
  }
  return pares;
}

const paleta = {
  primary: extraerEscala("primary"),
  secondary: extraerEscala("secondary"),
  accent: extraerEscala("accent"),
  neutro: extraerEscala("neutro"),
  whatsapp: extraerEscala("whatsapp"),
  // El alias heredado se comprueba también: mientras exista en el código tiene que
  // rendir cuentas igual que el resto.
  airbnb: extraerEscala("airbnb"),
  white: { DEFAULT: "#FFFFFF" },
};

/**
 * Resuelve un token (`primary-600`, `airbnb-rausch-hover`) a su hex.
 *
 * Se corta por el **primer** guion, no por todos: los tonos también llevan guion
 * (`rausch-hover`, `pink-badge`), y partirlos por cada guion resolvía
 * `airbnb-rausch-hover` como si fuera `rausch` —daba un ratio plausible pero del
 * color equivocado, que es la peor forma de fallar en una comprobación.
 */
const resolver = (token) => {
  if (token === "white") return "#FFFFFF";
  const corte = token.indexOf("-");
  const escala = corte === -1 ? token : token.slice(0, corte);
  const tono = corte === -1 ? "DEFAULT" : token.slice(corte + 1);
  const valor = paleta[escala]?.[tono];
  if (!valor) throw new Error(`Token no encontrado: ${token}`);
  return valor;
};

const aLineal = (canal) => {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminancia = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * aLineal(r) + 0.7152 * aLineal(g) + 0.0722 * aLineal(b);
};

const contraste = (hexA, hexB) => {
  const la = luminancia(hexA);
  const lb = luminancia(hexB);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
};

const COMBINACIONES = [
  { fondo: "primary-600", texto: "white", min: 4.5, uso: "Botones principales, sellos, CTA secundario" },
  { fondo: "primary-500", texto: "white", min: 3, uso: "Icono de check (gráfico)" },
  { fondo: "primary-50", texto: "primary-800", min: 4.5, uso: "Badges de servicios" },
  { fondo: "primary-100", texto: "primary-700", min: 4.5, uso: "Chips de características" },
  { fondo: "white", texto: "primary-600", min: 4.5, uso: "Enlaces e iconos sobre blanco" },
  { fondo: "accent-700", texto: "white", min: 4.5, uso: "CTA naranja y filtros activos (texto blanco)" },
  { fondo: "white", texto: "accent-700", min: 4.5, uso: "Precios en tamaño pequeño sobre blanco" },
  { fondo: "white", texto: "accent-500", min: 3, uso: "Precio grande (>= 20 px negrita) y estrellas" },
  { fondo: "neutro-50", texto: "accent-500", min: 3, uso: "Precio grande sobre fondo neutro" },
  { fondo: "secondary-100", texto: "secondary-700", min: 4.5, uso: "Footer (títulos y enlaces)" },
  { fondo: "secondary-100", texto: "secondary-600", min: 4.5, uso: "Footer (texto)" },
  { fondo: "whatsapp-deep", texto: "white", min: 4.5, uso: "Botones de WhatsApp" },
  { fondo: "primary-700", texto: "white", min: 4.5, uso: "Hover de CTA, coral profundo" },
  { fondo: "airbnb-rausch", texto: "white", min: 3, uso: "Iconos y gráficos sobre coral" },
  { fondo: "airbnb-rausch-hover", texto: "white", min: 4.5, uso: "CTA coral oscuro con texto blanco" },
  { fondo: "airbnb-pink-badge", texto: "airbnb-rausch", min: 3, uso: "Icono de favorito activo" },
  { fondo: "white", texto: "neutro-600", min: 4.5, uso: "Texto secundario" },
  { fondo: "white", texto: "neutro-700", min: 4.5, uso: "Texto de interfaz" },
];

let fallos = 0;
console.log("Combinación                         Ratio    Mínimo   Resultado   Uso");
console.log("-".repeat(100));

for (const c of COMBINACIONES) {
  const hexFondo = resolver(c.fondo);
  const hexTexto = resolver(c.texto);
  const ratio = contraste(hexFondo, hexTexto);
  const pasa = ratio >= c.min;
  if (!pasa) fallos += 1;
  const etiqueta = `${c.texto} sobre ${c.fondo}`.padEnd(35);
  console.log(
    `${etiqueta} ${ratio.toFixed(2).padStart(6)}   ${String(c.min).padStart(5)}   ${(pasa ? "PASA   " : "FALLA  ")}    ${c.uso}`
  );
}

// ---------------------------------------------------------------------------
// Vigilancia estructural: ningún color de fondo con texto blanco sin verificar.
//
// Cierra el hueco exacto que encontró la auditoría: los tres botones de conversión
// usaban `bg-airbnb-rausch` (#FF385C, 3,52:1) y este verificador no miraba ese
// token, así que daba «todo en verde» con los botones por debajo del mínimo. Ahora
// cualquier `bg-*` que conviva con `text-white` tiene que estar declarado arriba;
// si no, la comprobación falla y obliga a justificar el par (con su ratio).
// ---------------------------------------------------------------------------
const fuentes = [];
const recorrer = (dir) => {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const camino = join(dir, entrada.name);
    if (entrada.isDirectory()) recorrer(camino);
    else if (/\.tsx?$/.test(entrada.name)) fuentes.push(camino);
  }
};
recorrer("components");
recorrer("app");

const verificados = new Set(COMBINACIONES.filter((c) => c.texto === "white").map((c) => c.fondo));
const sinVerificar = new Map();

for (const archivo of fuentes) {
  const texto = readFileSync(archivo, "utf8");
  for (const coincidencia of texto.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const clases = (coincidencia[1] ?? coincidencia[2] ?? coincidencia[3] ?? "").split(/\s+/);
    if (!clases.includes("text-white")) continue;
    for (const clase of clases) {
      if (!/^bg-[a-z]+-\d+$/.test(clase)) continue;
      const token = clase.slice(3);
      if (!verificados.has(token) && !sinVerificar.has(token)) sinVerificar.set(token, archivo);
    }
  }
}

if (sinVerificar.size === 0) {
  console.log(
    `Vigilancia estructural: ${fuentes.length} archivos revisados, ningún color de fondo con texto blanco sin verificar.`
  );
} else {
  fallos += sinVerificar.size;
  for (const [token, archivo] of sinVerificar) {
    console.log(
      `FALLA  ${token} se usa con texto blanco (${archivo}) y no está entre los pares verificados.`
    );
  }
}

console.log("-".repeat(100));
if (fallos === 0) {
  console.log(`RESULTADO: todas las combinaciones cumplen WCAG AA (${COMBINACIONES.length} verificadas).`);
} else {
  console.log(`RESULTADO: ${fallos} combinación(es) por debajo del mínimo.`);
  process.exitCode = 1;
}
