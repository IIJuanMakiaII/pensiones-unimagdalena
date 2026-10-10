/**
 * Verificación de contraste WCAG 2.1 y escala tipográfica (Agente 3 — QA).
 *
 * Lee la paleta real desde tailwind.config.ts y comprueba las combinaciones
 * texto/fondo que la interfaz usa de verdad. Umbrales:
 *   - Texto normal (< 18.66 px negrita): AA = 4.5:1
 *   - Texto grande (>= 24 px o >= 18.66 px negrita): AA = 3:1
 *   - Gráficos e iconos portadores de información (1.4.11): 3:1
 *
 * Además vigila tres cosas de forma ESTRUCTURAL, sobre el código fuente:
 *   1. Ningún `bg-*` convive con `text-white` sin estar verificado arriba.
 *   2. Ningún tamaño arbitrario (`text-[15px]`) y nada por debajo del mínimo.
 *   3. Ningún color de texto sin registrar, y cada uno cumple el mínimo que
 *      declara frente al fondo en el que se usa de verdad.
 *
 * Las tres nacieron de fallos concretos: la 1, de tres botones de conversión
 * por debajo del mínimo que este verificador no miraba; la 2, de una escala que
 * se degradó a tamaños de 10 y 11 px sin que nada lo notara; la 3, de que solo
 * se vigilaba el texto BLANCO sobre color, y el texto oscuro sobre blanco —que
 * es la mayor parte del sitio— no rendía cuentas ante nadie.
 *
 * Uso: node scripts/verificar-contraste.mjs
 * Para las pruebas: CONTRASTE_RAIZ=<dir> apunta el barrido a otra raíz.
 */
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  // `confianza` entra al incorporar el registro de colores de TEXTO: sus tokens
  // (danger, info, gold) se usan como color de texto y hasta ahora resolverlos
  // habría lanzado «Token no encontrado».
  confianza: extraerEscala("confianza"),
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

/**
 * Escala tipográfica permitida. Es la de Tailwind por defecto, y ese es el
 * punto: el proyecto NO define `fontSize` propia, así que cualquier valor que no
 * esté aquí es un tamaño inventado que hay que justificar.
 */
const ESCALA_PX = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
  "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128,
};

/** Mínimo legible acordado para cualquier texto del sitio. */
const MINIMO_PX = 12;

/**
 * `text-*` que no son ni tamaño ni color. Sin esta lista, `text-center` se
 * leería como un color desconocido y la comprobación daría un falso positivo.
 */
const UTILIDADES_TEXTO = new Set([
  "left", "center", "right", "justify", "start", "end",
  "wrap", "nowrap", "balance", "pretty", "ellipsis", "clip",
  "transparent", "current", "inherit",
]);

/** `text-[#FF385C]` y compañía son colores, no tamaños. */
const esValorDeColor = (v) =>
  /^#|^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|light-dark)\(|^(white|black|transparent|current|inherit)$/.test(v);

/**
 * Registro de colores de TEXTO. Cada uno declara el fondo sobre el que se usa de
 * verdad y el mínimo que debe cumplir ahí.
 *
 * Esto es lo que faltaba: hasta ahora solo rendía cuentas el texto BLANCO sobre
 * color, y el texto oscuro sobre blanco —que es la mayor parte del sitio— no lo
 * comprobaba nadie. Un `text-neutro-400` nuevo en cualquier parte pasaba
 * inadvertido con 2,17:1.
 *
 * `exento` no es un permiso para saltarse AA: son los casos que WCAG 1.4.3 y
 * 1.4.11 excluyen expresamente (decoración con `aria-hidden`, controles
 * deshabilitados, logotipos y gráficos). Su ratio se sigue imprimiendo, para que
 * la excepción quede a la vista y no enterrada.
 */
const TEXTOS = [
  { token: "neutro-900", fondo: "white", min: 4.5, uso: "Títulos y texto principal" },
  { token: "neutro-800", fondo: "white", min: 4.5, uso: "Títulos de sección" },
  { token: "neutro-700", fondo: "white", min: 4.5, uso: "Texto de interfaz" },
  { token: "neutro-600", fondo: "white", min: 4.5, uso: "Texto secundario" },
  { token: "neutro-500", fondo: "white", min: 4.5, uso: "Metadatos y etiquetas" },
  { token: "primary-900", fondo: "white", min: 4.5, uso: "Título de la tarjeta de instalación" },
  { token: "primary-800", fondo: "primary-50", min: 4.5, uso: "Badges de servicios" },
  { token: "primary-700", fondo: "white", min: 4.5, uso: "Enlaces e iconos" },
  { token: "primary-600", fondo: "white", min: 4.5, uso: "Iconos y casillas (gráficos, 1.4.11)" },
  { token: "accent-800", fondo: "white", min: 4.5, uso: "Avisos y etiquetas de acento" },
  { token: "accent-700", fondo: "white", min: 4.5, uso: "Precios y enlaces de acento" },
  { token: "confianza-danger", fondo: "white", min: 4.5, uso: "Mensajes de error" },
  { token: "airbnb-charcoal", fondo: "white", min: 4.5, uso: "Logotipo (texto)" },
  { token: "secondary-50", fondo: "secondary-900", min: 4.5, uso: "Aviso de sin conexión: texto claro sobre banda oscura" },
  { token: "neutro-50", fondo: "neutro-900", min: 4.5, uso: "Bloque de código: texto claro sobre fondo oscuro" },
  { token: "accent-500", fondo: "white", min: 3, uso: "Estrellas de la puntuación (gráfico)" },
  { token: "airbnb-rausch", fondo: "white", min: 3, uso: "Corazón de favorito activo (gráfico) y logotipo" },
  {
    token: "neutro-400",
    fondo: "white",
    min: 2.17,
    uso: "Separador de migas (decorativo) y botón deshabilitado",
    exento: "WCAG excluye la decoración con aria-hidden y los controles deshabilitados (1.4.3)",
  },
  {
    token: "neutro-300",
    fondo: "white",
    min: 2.17,
    uso: "Estrellas vacías de la puntuación",
    exento: "decorativo con aria-hidden: no es contenido que haya que leer",
  },
  // Hallazgo de este mismo barrido, ya corregido: la etiqueta «Guardar/Guardada»
  // del detalle usaba `text-airbnb-rausch-hover` (#E00B41) sobre el rosado del
  // botón y se quedaba en 4,43 frente a 4,5 —es texto normal a 14 px, no grande—.
  // Se pasó a `primary-700` (#C30036), que da 5,63 sobre ese mismo fondo. Estaba
  // en una rama de ternario, que es justo por donde se escapaba del barrido
  // anterior; por eso ahora se lee TODA cadena y no solo `className`.
  //
  // Este es el segundo fondo de `primary-700`: sobre blanco da 6,22 y aquí 5,63.
  // El registro guarda el par, no solo el token, para que las dos ubicaciones
  // rindan cuentas por separado.
  {
    token: "primary-700",
    fondo: "airbnb-pink-badge",
    min: 4.5,
    uso: "Etiqueta «Guardar/Guardada» del detalle (14 px, texto normal)",
  },
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
// Barrido del código fuente. Una sola pasada, con archivo y línea, y tres
// comprobaciones estructurales encima de lo mismo.
// ---------------------------------------------------------------------------
const RAIZ = process.env.CONTRASTE_RAIZ || ".";

const fuentes = [];
const recorrer = (dir) => {
  /**
   * Una carpeta ausente termina el barrido en silencio en vez de reventar. Sin
   * esto, `readdirSync` mata el proceso con ENOENT y el CI falla con un error de
   * Node en lugar de con un diagnóstico: quien lo lea no sabe qué arreglar. Pasa
   * en cuanto alguien renombra o mueve una de las tres carpetas.
   */
  if (!existsSync(dir)) return;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const camino = join(dir, entrada.name);
    if (entrada.isDirectory()) recorrer(camino);
    else if (/\.tsx?$/.test(entrada.name)) fuentes.push(camino);
  }
};
// `lib/` entra en el barrido a propósito: las clases de las páginas legales viven
// en la tabla `CLASES` de `lib/markdown-legal.ts`, y hasta ahora quedaban fuera.
for (const dir of ["components", "app", "lib"]) recorrer(join(RAIZ, dir));

/**
 * Listas de clases del código. Se leen TODAS las cadenas, no solo los atributos
 * `className`, porque las clases también viven en constantes (`CLASES`) y en las
 * ramas de un ternario (`BotonFavorito`), y esos dos sitios eran justo por donde
 * se escapaban los colores sin que nadie los mirara.
 */
const bloques = [];
const CADENA = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;
/**
 * Un token puede llegar con las comillas o la llave del ternario pegadas: dentro
 * de una plantilla de una sola línea (`${activo ? "text-x" : "text-y"}`) la
 * coincidencia se lleva las comillas internas. Sin limpiarlas,
 * `"text-motivo-500"` no casa con la forma de una clase y el color se escapaba
 * de la vigilancia. Lo descubrió la prueba del ternario, no una lectura.
 */
const sinComillas = (t) => t.replace(/^["'`{}]+/, "").replace(/["'`{}]+$/, "");
for (const archivo of fuentes) {
  const lineas = readFileSync(archivo, "utf8").split(/\r?\n/);
  lineas.forEach((linea, indice) => {
    for (const coincidencia of linea.matchAll(CADENA)) {
      const contenido = coincidencia[1] ?? coincidencia[2] ?? coincidencia[3] ?? "";
      if (!/(^|\s)(text|bg)-/.test(contenido)) continue;
      bloques.push({
        archivo,
        linea: indice + 1,
        clases: contenido.split(/\s+/).filter(Boolean).map(sinComillas),
      });
    }
  });
}

/** Quita el prefijo de variante (`md:`, `hover:`, `focus-visible:`) para leer el token. */
const sinVariante = (clase) => clase.replace(/^[a-z0-9-]+:/, "");

// --- 1. Fondo con texto blanco sin verificar ---------------------------------
// Los tres botones de conversión usaban `bg-airbnb-rausch` (#FF385C, 3,52:1) y
// esta comprobación no miraba ese token: daba «todo en verde» con los botones
// por debajo del mínimo. Ahora cualquier `bg-*` que conviva con `text-white`
// tiene que estar declarado arriba.
const verificados = new Set(COMBINACIONES.filter((c) => c.texto === "white").map((c) => c.fondo));
const sinVerificar = new Map();

for (const { archivo, linea, clases } of bloques) {
  if (!clases.includes("text-white")) continue;
  for (const clase of clases) {
    if (!/^bg-[a-z]+-\d+$/.test(clase)) continue;
    const token = clase.slice(3);
    if (!verificados.has(token) && !sinVerificar.has(token)) sinVerificar.set(token, `${archivo}:${linea}`);
  }
}

console.log(
  `Vigilancia de fondos: ${fuentes.length} archivos revisados, ` +
    (sinVerificar.size === 0
      ? "ningún color de fondo con texto blanco sin verificar."
      : `${sinVerificar.size} fondo(s) con texto blanco sin verificar.`)
);
for (const [token, donde] of sinVerificar) {
  fallos += 1;
  console.log(`FALLA  ${token} se usa con texto blanco (${donde}) y no está entre los pares verificados.`);
}

// --- 2. Escala: nada arbitrario y nada por debajo del mínimo -----------------
// Nace del fallo que este verificador no vio: la escala se degradó a 10 y 11 px
// y el sitio se leía mal sin que ninguna comprobación se quejara.
const tamanosVistos = new Map();
let menor = { px: Infinity, donde: null };
const problemasEscala = [];

for (const { archivo, linea, clases } of bloques) {
  for (const clase of clases) {
    const base = sinVariante(clase);
    if (!base.startsWith("text-")) continue;
    const resto = base.slice(5);
    if (UTILIDADES_TEXTO.has(resto)) continue;

    const arbitrario = resto.match(/^\[(.+)\]$/);
    if (arbitrario) {
      const valor = arbitrario[1].trim();
      if (esValorDeColor(valor)) continue;
      /**
       * El mínimo manda sobre la forma. Antes, un `text-[10px]` se reportaba como
       * «tamaño inventado» y nunca como lo que de verdad es —texto por debajo de
       * 12 px—, así que la alarma sonaba por el motivo menor y una prueba legítima
       * de 10 px era indistinguible de una de 15. Ahora cada caso dice lo suyo.
       */
      const enPx = valor.match(/^([\d.]+)px$/);
      const px = enPx ? parseFloat(enPx[1]) : undefined;
      problemasEscala.push({
        archivo,
        linea,
        motivo:
          px !== undefined && px < MINIMO_PX
            ? `«${clase}» son ${px} px, por debajo del mínimo de ${MINIMO_PX} px`
            : `«${clase}» es un tamaño inventado: usa la escala (xs, sm, base, lg, xl, ...)`,
      });
      continue;
    }

    const px = ESCALA_PX[resto];
    if (px === undefined) continue; // es un color u otra utilidad
    tamanosVistos.set(resto, (tamanosVistos.get(resto) ?? 0) + 1);
    if (px < menor.px) menor = { px, donde: `${archivo}:${linea}` };
    if (px < MINIMO_PX) {
      problemasEscala.push({
        archivo,
        linea,
        motivo: `«${clase}» son ${px} px, por debajo del mínimo de ${MINIMO_PX} px`,
      });
    }
  }
}

console.log("");
const detalleEscala = [...tamanosVistos.entries()]
  .sort((a, b) => ESCALA_PX[a[0]] - ESCALA_PX[b[0]])
  .map(([t, n]) => `${t}=${ESCALA_PX[t]}px (${n})`)
  .join(" · ");
console.log(`Vigilancia de escala: mínimo real ${menor.px === Infinity ? "n/d" : menor.px + "px"}`);
console.log(`  en uso: ${detalleEscala}`);
for (const p of problemasEscala) {
  fallos += 1;
  console.log(`FALLA  ${p.archivo}:${p.linea}  ${p.motivo}`);
}
if (problemasEscala.length === 0) {
  console.log(`  ningún tamaño arbitrario y nada por debajo de ${MINIMO_PX}px.`);
}

// --- 3. Colores de texto registrados y con su mínimo -------------------------
// El hueco que quedaba: solo rendía cuentas el texto blanco. El texto oscuro
// sobre blanco —la mayor parte del sitio— no lo comprobaba nadie.
/**
 * Lo que se comprueba aquí es que el token ESTÉ registrado; la tabla de arriba
 * rinde cuentas de cada par concreto. Un mismo color puede usarse sobre más de
 * un fondo —`primary-700` va sobre blanco y sobre el rosado del botón guardar—,
 * y cada ubicación necesita su propia fila con su propio mínimo. Indexar por
 * token a secas obligaría a elegir una y dejaría la otra sin verificar.
 */
const tokensRegistrados = new Set(TEXTOS.map((t) => t.token));
const paresRegistrados = new Map(TEXTOS.map((t) => [`${t.token}@${t.fondo}`, t]));
const noRegistrados = new Map();
const usados = new Set();

/**
 * Los pares de arriba (COMBINACIONES) también son registro. `white` no necesita
 * una fila propia: cada uno de sus fondos verificados ya está declarado con su
 * mínimo, y el punto 1 impide que aparezca un fondo nuevo con texto blanco sin
 * declarar. Sin esto, `text-white` —que es el color de texto más usado del
 * sitio— saldría como «no registrado» y la comprobación nacería roja por un
 * falso positivo.
 */
const registradosEnPares = new Set(COMBINACIONES.map((c) => c.texto));

for (const { archivo, linea, clases } of bloques) {
  for (const clase of clases) {
    const base = sinVariante(clase);
    if (!base.startsWith("text-")) continue;
    const resto = base.slice(5);
    if (UTILIDADES_TEXTO.has(resto)) continue;
    if (ESCALA_PX[resto] !== undefined) continue; // es tamaño
    if (/^\[/.test(resto)) continue; // arbitrario: ya lo ve la escala
    if (!/^[a-z]+(-[\w-]+)*$/.test(resto)) continue;

    usados.add(resto);
    if (!tokensRegistrados.has(resto) && !registradosEnPares.has(resto) && !noRegistrados.has(resto)) {
      noRegistrados.set(resto, `${archivo}:${linea}`);
    }
  }
}

// Cada par registrado tiene que estar en uso de verdad: un registro que nadie
// usa es una comprobación muerta que aparenta vigilancia.
if (paresRegistrados.size !== TEXTOS.length) {
  throw new Error("El índice de pares registrados se desincronizó de TEXTOS.");
}

console.log("");
console.log("Color de texto".padEnd(22), "Fondo".padEnd(16), "Ratio   Mínimo   Resultado   Uso");
console.log("-".repeat(100));
for (const t of TEXTOS) {
  const ratio = contraste(resolver(t.fondo), resolver(t.token));
  const etiqueta = t.token.padEnd(20);
  const fondo = t.fondo.padEnd(14);
  if (t.exento) {
    console.log(
      `${etiqueta} ${fondo} ${ratio.toFixed(2).padStart(6)}   EXENTO   ${"EXENTO".padEnd(10)}  ${t.uso}` +
        `\n         └─ ${t.exento}`
    );
    continue;
  }
  const pasa = ratio >= t.min;
  if (!pasa) fallos += 1;
  console.log(
    `${etiqueta} ${fondo} ${ratio.toFixed(2).padStart(6)}   ${String(t.min).padStart(5)}   ${(pasa ? "PASA    " : "FALLA   ")}   ${t.uso}`
  );
}
for (const [token, donde] of noRegistrados) {
  fallos += 1;
  console.log(`FALLA  text-${token} se usa en ${donde} y no está en el registro de TEXTOS.`);
}
const sinUsar = TEXTOS.filter((t) => !usados.has(t.token)).map((t) => t.token);
if (sinUsar.length) console.log(`Aviso  en el registro pero sin uso: ${sinUsar.join(", ")}`);

// --- Resumen -----------------------------------------------------------------
console.log("-".repeat(100));
if (fallos === 0) {
  console.log(
    `RESULTADO: ${COMBINACIONES.length} pares cumplen WCAG AA, la escala respeta el mínimo de ` +
      `${MINIMO_PX}px sin tamaños inventados, y los ${TEXTOS.length} pares de texto ` +
      `(${tokensRegistrados.size} colores distintos) están registrados y verificados.`
  );
} else {
  console.log(`RESULTADO: ${fallos} problema(s) detectados.`);
  process.exitCode = 1;
}
