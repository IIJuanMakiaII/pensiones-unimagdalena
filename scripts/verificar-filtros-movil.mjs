/**
 * Verificación de los criterios de la tarea #40 — filtros en el móvil.
 *
 * Comprueba lo que se puede comprobar sin navegador, y lo dice:
 *
 *  1. Que la barra se recoge: la fila compacta existe y es solo de móvil, el
 *     panel de controles está colapsado por defecto y se abre con un botón que
 *     declara `aria-expanded` y `aria-controls`.
 *  2. Que quitar filtros está siempre disponible: chips con aspa individual y
 *     «Quitar todos», montados en el catálogo **antes** de saber si hay
 *     resultados (el fallo original era ofrecerlo solo en el estado vacío).
 *  3. La altura de la barra recogida, calculada desde las clases declaradas, y
 *     su proporción sobre un móvil de 375×812.
 *
 * Lo que NO comprueba, y por eso se imprime al final: el aspecto real a 375 px
 * ni el repintado en el navegador. Eso exige un navegador, que este entorno no
 * tiene; la verificación visual queda declarada como pendiente.
 *
 * Uso: node scripts/verificar-filtros-movil.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (ruta) => readFileSync(join(raiz, ruta), "utf8");

const filtros = leer("components/Filtros.tsx");
const chips = leer("components/ChipsFiltros.tsx");
const catalogo = leer("components/CatalogoInteractivo.tsx");

let fallos = 0;
const comprobar = (descripcion, condicion, detalle = "") => {
  const marca = condicion ? "✓" : "✗";
  console.log(`  ${marca} ${descripcion}${detalle ? ` — ${detalle}` : ""}`);
  if (!condicion) fallos += 1;
};

console.log("\n1 · La barra se recoge en móvil");

// Se toma desde el contenedor de la fila hasta el botón que abre el panel: ahí
// dentro están su relleno y el alto de su botón, que son los que definen cuánto
// ocupa la barra recogida.
const inicioFila = filtros.indexOf('<div className="mx-auto flex max-w-6xl items-center gap-2');
const finFila = filtros.indexOf('aria-controls="panel-filtros"');
const bloqueCompacto =
  inicioFila !== -1 && finFila > inicioFila ? filtros.slice(inicioFila, finFila + 200) : null;
comprobar("existe una fila compacta exclusiva de móvil", Boolean(bloqueCompacto));

comprobar(
  "el botón que abre el panel declara su estado",
  filtros.includes("aria-expanded={abierto}") && filtros.includes('aria-controls="panel-filtros"')
);

comprobar(
  "el panel de controles está colapsado hasta que se abre",
  /\$\{abierto \? "block" : "hidden"\} lg:block/.test(filtros),
  'clases `${abierto ? "block" : "hidden"} lg:block`'
);

comprobar(
  "en escritorio el panel sigue siempre desplegado",
  filtros.includes("lg:block") && /lg:py-3/.test(filtros)
);

comprobar(
  "el panel se cierra con un botón, no solo tocando fuera",
  /Ver \$\{resultados\} pensiones|resultados === 1 \? "Ver 1 pensión"/.test(filtros)
);

comprobar(
  "al cerrar, el foco vuelve al botón que lo abrió",
  filtros.includes("botonRef.current?.focus()")
);

console.log("\n2 · Quitar filtros, siempre disponible");

comprobar(
  "los chips se montan en el catálogo",
  catalogo.includes("<ChipsFiltros")
);

comprobar(
  "y se montan siempre, no solo cuando no hay resultados",
  // El montaje no puede estar dentro de la rama del estado vacío.
  (() => {
    const posicionChips = catalogo.indexOf("<ChipsFiltros");
    const posicionEstadoVacio = catalogo.indexOf("<EstadoVacio");
    if (posicionChips === -1) return false;
    // Los chips van antes del bloque de resultados (y del estado vacío).
    return posicionEstadoVacio === -1 || posicionChips < posicionEstadoVacio;
  })()
);

comprobar(
  "cada filtro activo se puede quitar por separado",
  chips.includes("quitarFiltro(filtros, clave, precioMaximoReal)") &&
    chips.includes("aria-label={`Quitar filtro: ")
);

comprobar(
  "existe la acción de quitar todos y dice cuántos hay",
  chips.includes("Quitar todos") && chips.includes("filtros aplicados")
);

comprobar(
  "quitar todos conserva el orden elegido",
  /FILTROS_INICIALES, precioMaximoCop: precioMaximoReal, orden: filtros\.orden/.test(chips)
);

console.log("\n3 · Altura de la barra recogida (375 px de ancho)");

// Tailwind: 1 unidad de espaciado = 4 px. Se leen las clases declaradas, no se supone.
const px = (clase, bloque) => {
  const m = bloque?.match(new RegExp(`${clase}-(\\d+(?:\\.\\d+)?)`));
  return m ? Number(m[1]) * 4 : null;
};

const rellenoVertical = px("py", bloqueCompacto);
const altoBoton = px("h", bloqueCompacto);
const borde = 1;

comprobar("se leyó el relleno vertical de la fila", rellenoVertical !== null, `py → ${rellenoVertical}px`);
comprobar("se leyó el alto del botón de filtros", altoBoton !== null, `h → ${altoBoton}px`);

const altoBarra = (rellenoVertical ?? 0) * 2 + (altoBoton ?? 0) + borde;
const ALTO_MOVIL = 812; // iPhone X/11/12 en vertical, el más común.
const proporcion = (altoBarra / ALTO_MOVIL) * 100;

console.log(`     barra recogida: ${altoBarra} px de ${ALTO_MOVIL} px útiles = ${proporcion.toFixed(1)} % del alto`);
comprobar("no ocupa la mayor parte del alto", proporcion < 25, `${proporcion.toFixed(1)} % < 25 %`);
comprobar("ni siquiera una quinta parte", proporcion < 20, `${proporcion.toFixed(1)} % < 20 %`);

// Referencia del "antes": cuatro controles desplegados (deslizador + 3 filas),
// estimada a partir de sus clases declaradas, no medida en pantalla.
const altoDesplegado = 16 + 60 + 44 * 3 + 8 * 3 + 44;
console.log(
  `     (referencia estimada del antes: ${altoDesplegado} px = ${((altoDesplegado / ALTO_MOVIL) * 100).toFixed(1)} % — nunca se midió en pantalla)`
);

console.log("\n4 · Lo que no se pudo comprobar aquí");
console.log("  ! el repintado y el aspecto real a 375 px exigen un navegador, que este entorno no tiene.");
console.log("  ! se verificó la estructura declarada y la aritmética de la altura, no el píxel en pantalla.\n");

if (fallos > 0) {
  console.error(`✗ ${fallos} comprobación(es) fallida(s)\n`);
  process.exit(1);
}
console.log("✓ Todas las comprobaciones estructurales pasaron\n");
