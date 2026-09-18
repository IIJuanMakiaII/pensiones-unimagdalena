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
  white: { DEFAULT: "#FFFFFF" },
};

const resolver = (token) => {
  if (token === "white") return "#FFFFFF";
  const [escala, tono] = token.split("-");
  const valor = paleta[escala]?.[tono ?? "DEFAULT"];
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
  { fondo: "primary-600", texto: "primary-100", min: 4.5, uso: "Subtítulo del hero" },
  { fondo: "primary-50", texto: "primary-800", min: 4.5, uso: "Badges de servicios" },
  { fondo: "primary-100", texto: "primary-700", min: 4.5, uso: "Chips de características" },
  { fondo: "white", texto: "primary-600", min: 4.5, uso: "Enlaces e iconos sobre blanco" },
  { fondo: "accent-700", texto: "white", min: 4.5, uso: "CTA naranja y filtros activos (texto blanco)" },
  { fondo: "white", texto: "accent-700", min: 4.5, uso: "Precios en tamaño pequeño sobre blanco" },
  { fondo: "white", texto: "accent-500", min: 3, uso: "Precio grande (>= 20 px negrita) y estrellas" },
  { fondo: "neutro-50", texto: "accent-500", min: 3, uso: "Precio grande sobre fondo neutro" },
  { fondo: "secondary-700", texto: "secondary-100", min: 4.5, uso: "Footer (títulos)" },
  { fondo: "secondary-700", texto: "secondary-200", min: 4.5, uso: "Footer (texto)" },
  { fondo: "secondary-700", texto: "secondary-300", min: 4.5, uso: "Footer (texto legal)" },
  { fondo: "whatsapp-deep", texto: "white", min: 4.5, uso: "Botones de WhatsApp" },
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

console.log("-".repeat(100));
if (fallos === 0) {
  console.log(`RESULTADO: todas las combinaciones cumplen WCAG AA (${COMBINACIONES.length} verificadas).`);
} else {
  console.log(`RESULTADO: ${fallos} combinación(es) por debajo del mínimo.`);
  process.exitCode = 1;
}
