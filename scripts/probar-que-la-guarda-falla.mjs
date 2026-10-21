/**
 * Demostración de que la guarda `verificar-filtros-movil` sabe fallar.
 *
 * Copia `components/Filtros.tsx`, le mete una rotura concreta, corre la guarda y
 * comprueba que la marca afectada se pone en rojo. Después restaura el original,
 * byte a byte. Si alguna mutación pasara inadvertida, este script falla: significaría
 * que esa comprobación no protege nada.
 *
 * Uso: node scripts/probar-que-la-guarda-falla.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const archivo = join(raiz, "components", "Filtros.tsx");
const respaldo = join(raiz, "components", "Filtros.tsx.respaldo-mutacion");

const mutaciones = [
  {
    nombre: "la barra de móvil deja de ser exclusiva de móvil",
    de: 'className="lg:hidden"',
    a: 'className=""',
    debeFallar: "existe una fila compacta exclusiva de móvil",
  },
  {
    nombre: "en escritorio arranca plegado",
    de: "const [plegado, setPlegado] = useState(false);",
    a: "const [plegado, setPlegado] = useState(true);",
    debeFallar: "en escritorio arranca desplegado",
  },
  {
    nombre: "plegar deja de ocultar el panel en escritorio",
    de: '${plegado ? "lg:hidden" : "lg:block"}',
    a: "lg:block",
    debeFallar: "en escritorio plegar oculta con CSS",
  },
  {
    nombre: "el contador de filtros desaparece del botón",
    de: "{activos > 0 ? `Filtros (${activos})` : \"Filtros\"}",
    a: "Filtros",
    debeFallar: "el contador de filtros activos se ve con el panel plegado",
  },
  {
    nombre: "al plegar en escritorio el foco se pierde",
    de: "botonEscritorioRef.current?.focus();",
    a: "void 0;",
    debeFallar: "al plegar en escritorio, el foco vuelve a su botón",
  },
  {
    nombre: "el panel se desmonta en vez de ocultarse",
    de: 'id="panel-filtros"',
    a: '{!plegado && (\n      <div id="panel-filtros"',
    debeFallar: "plegar oculta, no desmonta",
  },
];

const original = readFileSync(archivo, "utf8");
copyFileSync(archivo, respaldo);

let sorpresas = 0;
try {
  for (const m of mutaciones) {
    if (!original.includes(m.de)) {
      console.log(`  ✗ «${m.nombre}»: no se encontró el texto a mutar — la prueba no prueba nada`);
      sorpresas += 1;
      continue;
    }
    writeFileSync(archivo, original.replace(m.de, m.a), "utf8");

    let salida = "";
    try {
      salida = execFileSync(process.execPath, [join(raiz, "scripts", "verificar-filtros-movil.mjs")], {
        encoding: "utf8",
      });
    } catch (error) {
      salida = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }

    const lineaRota = salida
      .split("\n")
      .find((linea) => linea.includes("✗") && linea.includes(m.debeFallar));
    const marco = lineaRota ? "✓" : "✗";
    if (!lineaRota) sorpresas += 1;
    console.log(`  ${marco} ${m.nombre}`);
    console.log(`      esperaba rojo en: «${m.debeFallar}»`);
    if (lineaRota) console.log(`      ${lineaRota.trim()}`);
  }
} finally {
  writeFileSync(archivo, original, "utf8");
  unlinkSync(respaldo);
}

// Restauración verificada: el archivo debe volver a estar idéntico.
const restaurado = readFileSync(archivo, "utf8");
console.log(
  `\n  ${restaurado === original ? "✓" : "✗"} el archivo quedó restaurado byte a byte (${original.length} caracteres)`
);
if (restaurado !== original) sorpresas += 1;

if (sorpresas > 0) {
  console.error(`✗ ${sorpresas} mutación(es) no fueron detectadas\n`);
  process.exit(1);
}
console.log("✓ La guarda detectó las 6 roturas que se le presentaron\n");
