/**
 * Verificación de los criterios de la tarea #40 — filtros en el móvil —, ampliada
 * en la tarea #96 al plegado de escritorio.
 *
 * QUÉ CAMBIÓ Y POR QUÉ
 * --------------------
 * Esta guarda se escribió cuando el plegado era **solo de móvil**. Afirmaba, entre
 * otras cosas, que «en escritorio el panel sigue siempre desplegado»: eso era el
 * contrato de entonces y la tarea #96 lo sustituye a propósito —escritorio ahora
 * se pliega—, así que esa frase ya no puede ser cierta. Dejar una comprobación que
 * pasa pero afirma lo contrario de lo que hace el código es peor que no tenerla.
 *
 * Por eso la sección 1 se reescribe: **no se quita ninguna garantía de móvil** (se
 * conservan todas, una por una), y se añaden las de escritorio que #96 introduce.
 * Las secciones 2 y 4 siguen intactas.
 *
 * Comprueba lo que se puede comprobar sin navegador, y lo dice:
 *
 *  1a. Móvil y tablet: la fila compacta existe y es solo de esa familia de
 *      pantallas, el panel arranca plegado y se abre con un botón que declara
 *      `aria-expanded` y `aria-controls`.
 *  1b. Escritorio (tarea #96): el panel arranca **desplegado**, se pliega con un
 *      botón propio, se oculta con `hidden` sin desmontarse, y el contador de
 *      filtros activos sigue visible con el panel plegado.
 *  2.  Que quitar filtros está siempre disponible.
 *  3.  La altura de la barra recogida, calculada desde las clases declaradas, y su
 *      proporción sobre un móvil de 375×812.
 *
 * Lo que NO comprueba, y por eso se imprime al final: el aspecto real ni el
 * repintado. Eso exige un navegador, que este entorno no tiene; la verificación
 * visual queda declarada como pendiente en la sección 4.
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

/** Trozo de código entre dos marcas, o null si alguna no está o están al revés. */
const entre = (desde, hasta) => {
  const inicio = filtros.indexOf(desde);
  const fin = filtros.indexOf(hasta, inicio === -1 ? 0 : inicio);
  return inicio !== -1 && fin > inicio ? filtros.slice(inicio, fin) : null;
};

/** Cuántas veces aparece una cadena. Sirve para demostrar que no hay copias. */
const veces = (cadena) => filtros.split(cadena).length - 1;

console.log("\n1a · La barra se recoge en móvil y tablet (sin cambios)");

// La fila de móvil/tablet: la que solo se pinta por debajo de 1024 px.
const barraMovil = entre("<BarraFiltros", "botonRef={botonRef}");
comprobar(
  "existe una fila compacta exclusiva de móvil",
  Boolean(barraMovil) && barraMovil.includes('className="lg:hidden"')
);

// La de escritorio: invisible hasta 1024 px y fila a partir de ahí.
const barraEscritorio = entre('className="hidden lg:flex"', "onQuitar={quitarTodos}");
comprobar(
  "existe una fila propia de escritorio y solo aparece a partir de 1024 px",
  Boolean(barraEscritorio)
);

comprobar(
  "el botón que abre el panel declara su estado",
  filtros.includes("aria-expanded={abierto}") && filtros.includes('aria-controls="panel-filtros"')
);

comprobar(
  "en móvil el panel sigue arrancando plegado",
  /const \[abierto, setAbierto\] = useState\(false\)/.test(filtros),
  "abierto → false de partida"
);

comprobar(
  "en móvil el panel se abre y se cierra con ese estado",
  /\$\{abierto \? "block" : "hidden"\}/.test(filtros),
  'clases `${abierto ? "block" : "hidden"} …`'
);

console.log("\n1b · El panel se pliega también en escritorio (tarea #96)");

comprobar(
  "en escritorio arranca desplegado: plegar es una acción del usuario",
  /const \[plegado, setPlegado\] = useState\(false\)/.test(filtros),
  "plegado → false de partida"
);

comprobar(
  "en escritorio plegar oculta con CSS y desplegar vuelve a mostrarlo",
  /plegado \? "lg:hidden" : "lg:block"/.test(filtros),
  'clases `plegado ? "lg:hidden" : "lg:block"`'
);

// Plegar no desmonta: el panel es un <div> incondicional. Si alguien lo metiera en
// un `{plegado && (…)}` o un ternario, el estado interno de los controles
// (posición del deslizador, desplazamiento) se perdería y los valores dejarían de
// ser los mismos al reabrir. Se comprueba que la etiqueta no cuelga de una condición.
const antesDelPanel = (() => {
  const i = filtros.indexOf('id="panel-filtros"');
  return i === -1 ? null : filtros.slice(Math.max(0, i - 40), i);
})();
comprobar(
  "plegar oculta, no desmonta: el panel no cuelga de ninguna condición",
  Boolean(antesDelPanel) && !/[?&]/.test(antesDelPanel),
  "el <div> del panel se pinta siempre"
);

comprobar(
  "el panel conserva su id, que es a lo que apuntan los dos botones",
  veces('id="panel-filtros"') === 1 && veces('aria-controls="panel-filtros"') === 1,
  `id: ${veces('id="panel-filtros"')} · aria-controls: ${veces('aria-controls="panel-filtros"')} (un solo botón, reutilizado en las dos barras)`
);

comprobar(
  "la barra pegajosa conserva su relleno vertical en escritorio",
  /lg:py-3/.test(filtros)
);

comprobar(
  "el contador de filtros activos se ve con el panel plegado",
  // El rótulo del botón depende de `activos`, nunca de si el panel está abierto.
  /activos > 0 \? `Filtros \(\$\{activos\}\)` : "Filtros"/.test(filtros) &&
    !/abierto[^)\n]*Filtros \(\$\{activos\}\)/.test(filtros),
  "«Filtros (N)» en el botón, no dentro del panel"
);

comprobar(
  "la flecha indica la dirección del cambio en las dos barras",
  filtros.includes("<IconoFlecha abierto={abierto} />")
);

comprobar(
  "el panel se cierra con un botón, no solo tocando fuera",
  /Ver \$\{resultados\} pensiones|resultados === 1 \? "Ver 1 pensión"/.test(filtros)
);

comprobar(
  "al cerrar en móvil, el foco vuelve al botón que lo abrió",
  filtros.includes("botonRef.current?.focus()")
);

comprobar(
  "al plegar en escritorio, el foco vuelve a su botón y no se pierde",
  filtros.includes("botonEscritorioRef.current?.focus()")
);

comprobar(
  "el botón de escritorio es alcanzable con teclado y con foco visible",
  /focus-visible:outline-2/.test(filtros) && filtros.includes("focus-visible:outline-accent-700")
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

// Desde la tarea #96 la fila y el botón viven en dos componentes del mismo
// archivo (`BarraFiltros` y `BotonFiltros`), no en un bloque único: se leen donde
// están ahora, que es de donde salen los mismos píxeles.
const bloqueFila = entre("flex max-w-6xl items-center gap-2", "<BotonFiltros");
const bloqueBoton = entre("function BotonFiltros", "<IconoFiltro />");

const rellenoVertical = px("py", bloqueFila);
const altoBoton = px("h", bloqueBoton);
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
