/**
 * Filtros del móvil, medidos EN UN NAVEGADOR (tareas #40 y #43).
 *
 * El verificador `verificar:filtros-movil` comprueba la estructura declarada en el
 * código —que la fila compacta existe, que el panel se abre, que los chips se
 * montan siempre— y el alto calculado desde las clases. Eso deja fuera lo que el
 * fundador ve en su teléfono, que es justo lo que reportó: que la barra ocupaba
 * media pantalla y que no había forma de quitar los filtros.
 *
 * Esto mide en un Chrome real a 375×812, sin la base de datos (usa el catálogo de
 * demostración, `?demo=1`) y sin credenciales:
 *
 *  1. El alto **real** de la barra recogida con la página desplazada hasta que la
 *     barra se queda pegada arriba —el caso exacto del fundador, que la ve fija
 *     mientras recorre el catálogo.
 *  2. Que con resultados en pantalla se puede quitar **un filtro concreto** y
 *     **todos**, y que esas acciones están a la vista sin desplazarse.
 *  3. Que al cerrar el panel el foco vuelve al botón que lo abrió.
 *
 * Deja una captura de cada estado en `tmp/capturas-filtros-movil/` para poder
 * verlo sin montar nada.
 *
 * Dos detalles del arnés que importan para que la medida sea válida: el sitio
 * declara `scroll-behavior: smooth`, así que los desplazamientos se piden con
 * `behavior: "instant"` (si no, se mide a mitad de la animación); y la barra vive
 * **debajo de la portada**, así que hay que desplazarse hasta pasarla para poder
 * comprobar que se queda pegada.
 *
 * Requiere el servidor en marcha (`npm run build && npm start`, o `npm run dev`) y
 * un Chrome o Edge instalado. Si no hay navegador, lo dice y no aprueba en falso.
 *
 * Uso: npm run verificar:filtros-movil-navegador
 */
import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirNavegador, rutaDelNavegador } from "./navegador.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
/** Con un filtro de precio puesto desde la dirección: 5 pensiones de 6. */
const CON_FILTRO = `${BASE}/?demo=1&precio=700000`;
const CAPTURAS = join(raiz, "tmp", "capturas-filtros-movil");
const ALTO_MOVIL = 812;
/** Lo que la tarea #40 declara para la barra recogida, con un píxel de holgura. */
const DECLARADO = 61;

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

let fallos = 0;
const comprobar = (descripcion, condicion, detalle = "") => {
  const marca = condicion ? "✓" : "✗";
  console.log(`  ${marca} ${descripcion}${detalle ? ` — ${detalle}` : ""}`);
  if (!condicion) fallos += 1;
};

const BOTON_ABRIR = 'button[aria-controls="panel-filtros"]';
const CONTAR_RESULTADOS = `document.querySelectorAll("article").length`;
const CONTAR_CHIPS = `document.querySelectorAll('button[aria-label^="Quitar filtro:"]').length`;

/** Alto, posición y naturaleza de la barra (el contenedor pegajoso) y de su fila. */
const MEDIR_BARRA = `(() => {
  const boton = document.querySelector(${JSON.stringify(BOTON_ABRIR)});
  const fila = boton ? boton.parentElement : null;
  const barra = fila ? fila.parentElement : null;
  const r = barra ? barra.getBoundingClientRect() : null;
  const f = fila ? fila.getBoundingClientRect() : null;
  return {
    hayBarra: Boolean(barra),
    position: barra ? getComputedStyle(barra).position : null,
    altoBarra: r ? Math.round(r.height * 10) / 10 : null,
    altoFila: f ? Math.round(f.height * 10) / 10 : null,
    arriba: r ? Math.round(r.top * 10) / 10 : null,
    topDocumento: r ? Math.round(r.top + window.scrollY) : null,
    expandido: boton ? boton.getAttribute("aria-expanded") : null,
    scrollY: window.scrollY,
    altoVentana: window.innerHeight
  };
})()`;

/** Pulsa un botón por su texto (lo que hay en la página, no una suposición). */
const PULSAR_POR_TEXTO = (texto, exacto = false) => `(() => {
  const botones = [...document.querySelectorAll("button")];
  const objetivo = botones.find((b) => {
    const t = b.textContent.trim();
    return ${exacto ? `t === ${JSON.stringify(texto)}` : `t.includes(${JSON.stringify(texto)})`};
  });
  if (!objetivo) return "no encontrado";
  objetivo.click();
  return "pulsado";
})()`;

/** Cierra el panel con su propio botón (el que lleva el recuento delante). */
const CERRAR_PANEL = `(() => {
  const cerrar = [...document.querySelectorAll("#panel-filtros button")]
    .find((b) => /^Ver \\d+ pensi/.test(b.textContent.trim()));
  if (!cerrar) return "no encontrado";
  cerrar.click();
  return "pulsado";
})()`;

async function main() {
  console.log("\nFiltros del móvil, medidos en un navegador");
  console.log(`  servidor: ${BASE}`);
  console.log(`  ventana:  375×${ALTO_MOVIL} (móvil)\n`);

  if (!rutaDelNavegador()) {
    console.log("  ✗ no encuentro Chrome ni Edge.");
    console.log("    Define CHROME_PATH con la ruta del ejecutable para poder medir.");
    process.exitCode = 1;
    return;
  }

  // Se parte de una carpeta limpia: si no, las capturas de una ejecución anterior
  // se quedan mezcladas con las de esta y quien las mire no sabe cuál es cuál.
  rmSync(CAPTURAS, { recursive: true, force: true });

  const navegador = await abrirNavegador({ ancho: 375, alto: ALTO_MOVIL });

  try {
    await navegador.ir(CON_FILTRO, { esperarSelector: "article" });

    // ------------------------------------------------- 1 · la barra, desplazando
    console.log("1 · La barra, con la página desplazada");
    const inicial = await navegador.leer(MEDIR_BARRA);
    const resultados = await navegador.evaluar(CONTAR_RESULTADOS);
    comprobar("el catálogo de demostración tiene contenido", resultados > 0, `${resultados} pensiones`);
    comprobar("existe la barra y es pegajosa", inicial.hayBarra && inicial.position === "sticky", `position: ${inicial.position}`);
    comprobar("está recogida al abrir la página", inicial.expandido === "false", `aria-expanded=${inicial.expandido}`);

    // Desplaza hasta pasar la barra (vive debajo de la portada) de forma
    // instantánea: el sitio declara `scroll-behavior: smooth` y una animación a
    // medias daría un alto y una posición falsos.
    await navegador.evaluar(`(() => {
      const boton = document.querySelector(${JSON.stringify(BOTON_ABRIR)});
      const barra = boton.parentElement.parentElement;
      const arriba = barra.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: arriba + 400, behavior: "instant" });
      return "desplazado";
    })()`);
    await dormir(350);
    const pegada = await navegador.leer(MEDIR_BARRA);
    const capturaBarra = await navegador.capturar(join(CAPTURAS, "1-barra-recogida.png"));

    comprobar(
      "se queda pegada arriba al recorrer el catálogo",
      pegada.arriba !== null && pegada.arriba <= 1,
      `desplazada ${pegada.scrollY} px · borde superior en ${pegada.arriba} px`
    );
    comprobar(
      "el alto medido no supera lo declarado",
      pegada.altoBarra !== null && pegada.altoBarra <= DECLARADO + 1,
      `medida ${pegada.altoBarra} px · declarada ${DECLARADO} px (fila interior: ${pegada.altoFila} px)`
    );
    comprobar(
      "no ocupa una parte apreciable de la pantalla",
      pegada.altoBarra !== null && pegada.altoBarra / ALTO_MOVIL < 0.1,
      `${Math.round((pegada.altoBarra / ALTO_MOVIL) * 1000) / 10} % de ${ALTO_MOVIL} px`
    );

    // ------------------------------------- 2 · quitar filtros con resultados a la vista
    console.log("\n2 · Quitar filtros con resultados en pantalla");
    // Se coloca la página donde la deja el propio gesto de filtrar: los chips justo
    // debajo de la barra, que es el momento en que el estudiante quiere deshacer lo
    // que acaba de poner. No se le puede pedir además que la tarjeta entre entera
    // —en 375 px el bloque de filtros, chips y orden ocupa su sitio—, así que se
    // mide cuánto asoma.
    await navegador.evaluar(`(() => {
      const aspa = document.querySelector('button[aria-label^="Quitar filtro:"]');
      const chips = aspa.closest("div");
      const barra = document.querySelector(${JSON.stringify(BOTON_ABRIR)}).parentElement.parentElement;
      const destino =
        chips.getBoundingClientRect().top + window.scrollY - barra.getBoundingClientRect().height - 8;
      window.scrollTo({ top: Math.max(0, destino), behavior: "instant" });
      return "ok";
    })()`);
    await dormir(350);

    const aLaVista = await navegador.leer(`(() => {
      const boton = document.querySelector(${JSON.stringify(BOTON_ABRIR)});
      const barra = boton.parentElement.parentElement;
      const rb = barra.getBoundingClientRect();
      const dentro = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
      };
      const aspas = [...document.querySelectorAll('button[aria-label^="Quitar filtro:"]')];
      const todos = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Quitar todos");
      const tarjetas = [...document.querySelectorAll("article")];
      const primera = tarjetas[0] ? tarjetas[0].getBoundingClientRect() : null;
      return {
        chips: aspas.length,
        aspasVisibles: aspas.length > 0 && aspas.every(dentro),
        todosVisible: dentro(todos),
        barraArriba: Math.round(rb.top),
        barraAbajo: Math.round(rb.bottom),
        chipArriba: aspas.length > 0 ? Math.round(aspas[0].getBoundingClientRect().top) : null,
        chipsDebajoDeLaBarra: aspas.length > 0 && aspas.every((a) => a.getBoundingClientRect().top >= rb.bottom - 1),
        tarjetasCompletas: tarjetas.filter(dentro).length,
        primeraVisible: primera ? Math.round(Math.min(primera.bottom, window.innerHeight) - Math.max(primera.top, 0)) : 0,
        resultados: tarjetas.length,
        altoVentana: window.innerHeight
      };
    })()`);
    comprobar("hay un filtro puesto y resultados", aLaVista.chips > 0 && aLaVista.resultados > 0, `${aLaVista.chips} chip(s) · ${aLaVista.resultados} pensiones`);
    comprobar("el aspa de cada filtro está a la vista sin desplazarse", aLaVista.aspasVisibles, `aspa a ${aLaVista.chipArriba} px de arriba`);
    comprobar("«Quitar todos» también está a la vista", aLaVista.todosVisible);
    comprobar("las acciones no quedan tapadas por la barra pegajosa", aLaVista.chipsDebajoDeLaBarra, `la barra llega hasta ${aLaVista.barraAbajo} px`);
    comprobar(
      "y hay resultados en esa misma pantalla",
      aLaVista.primeraVisible >= 120,
      `la primera tarjeta asoma ${aLaVista.primeraVisible} px (${aLaVista.tarjetasCompletas} entera(s) de ${aLaVista.resultados})`
    );
    await navegador.capturar(join(CAPTURAS, "2-chips-con-resultados.png"));

    // Y mientras se recorre la lista, el atajo de la barra sigue a la vista: es la
    // garantía de que deshacer no obliga a volver arriba.
    await navegador.evaluar(`(() => {
      const primera = document.querySelector("article");
      const arriba = primera.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, arriba - 200), behavior: "instant" });
      return "ok";
    })()`);
    await dormir(350);
    const recorriendo = await navegador.leer(`(() => {
      const barra = document.querySelector(${JSON.stringify(BOTON_ABRIR)}).parentElement.parentElement;
      const rb = barra.getBoundingClientRect();
      const atajo = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Quitar");
      const ra = atajo ? atajo.getBoundingClientRect() : null;
      const tarjeta = document.querySelector("article").getBoundingClientRect();
      return {
        barraArriba: Math.round(rb.top),
        hayAtajo: Boolean(atajo),
        atajoVisible: Boolean(ra) && ra.top >= 0 && ra.bottom <= window.innerHeight,
        tarjetaVisible: Math.round(Math.min(tarjeta.bottom, window.innerHeight) - Math.max(tarjeta.top, 0))
      };
    })()`);
    comprobar("recorriendo la lista, la barra sigue pegada arriba", recorriendo.barraArriba <= 1, `borde superior en ${recorriendo.barraArriba} px`);
    comprobar(
      "y su atajo para quitar los filtros sigue a la vista",
      recorriendo.hayAtajo && recorriendo.atajoVisible,
      `la primera tarjeta muestra ${recorriendo.tarjetaVisible} px`
    );
    await navegador.capturar(join(CAPTURAS, "2b-recorriendo-resultados.png"));

    // Se vuelve a la posición donde el aspa está a la vista y se pulsa ahí: quitar
    // un filtro es un gesto sobre lo que se está viendo.
    await navegador.evaluar(`(() => {
      const chips = document.querySelector('button[aria-label^="Quitar filtro:"]').closest("div");
      const barra = document.querySelector(${JSON.stringify(BOTON_ABRIR)}).parentElement.parentElement;
      const destino =
        chips.getBoundingClientRect().top + window.scrollY - barra.getBoundingClientRect().height - 8;
      window.scrollTo({ top: Math.max(0, destino), behavior: "instant" });
      return "ok";
    })()`);
    await dormir(300);

    const trasUno = await navegador.evaluar(`(() => {
      const aspa = document.querySelector('button[aria-label^="Quitar filtro:"]');
      if (!aspa) return "sin aspa";
      aspa.click();
      return "pulsada";
    })()`);
    await dormir(500);
    const uno = await navegador.leer(`(() => ({ chips: ${CONTAR_CHIPS}, resultados: ${CONTAR_RESULTADOS} }))()`);
    comprobar(
      "quitar un filtro concreto lo retira solo a él",
      trasUno === "pulsada" && uno.chips === aLaVista.chips - 1,
      `${aLaVista.chips} → ${uno.chips} chip(s) · ${aLaVista.resultados} → ${uno.resultados} pensiones`
    );
    await navegador.capturar(join(CAPTURAS, "3-tras-quitar-uno.png"));

    // Pone dos filtros desde el panel y los quita de golpe.
    await navegador.evaluar(`document.querySelector(${JSON.stringify(BOTON_ABRIR)}).click(); "ok"`);
    await dormir(400);
    await navegador.evaluar(PULSAR_POR_TEXTO("Con alimentación"));
    await dormir(300);
    await navegador.evaluar(PULSAR_POR_TEXTO("Femenino"));
    await dormir(400);
    await navegador.evaluar(CERRAR_PANEL);
    await dormir(450);

    await navegador.evaluar(`(() => {
      const contenedor = document.querySelector('button[aria-label^="Quitar filtro:"]').closest("div");
      contenedor.scrollIntoView({ block: "start", behavior: "instant" });
      return "ok";
    })()`);
    await dormir(300);

    const conDos = await navegador.leer(`(() => ({ chips: ${CONTAR_CHIPS}, resultados: ${CONTAR_RESULTADOS} }))()`);
    comprobar("se pueden poner varios filtros y cada uno tiene su aspa", conDos.chips >= 2, `${conDos.chips} chips · ${conDos.resultados} pensiones`);
    await navegador.capturar(join(CAPTURAS, "4-varios-filtros.png"));

    const pulsadoTodos = await navegador.evaluar(PULSAR_POR_TEXTO("Quitar todos", true));
    await dormir(600);
    const todos = await navegador.leer(`(() => ({
      chips: ${CONTAR_CHIPS},
      resultados: ${CONTAR_RESULTADOS},
      atajoQuitar: Boolean([...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Quitar"))
    }))()`);
    comprobar(
      "«Quitar todos» los retira de una vez",
      pulsadoTodos === "pulsado" && todos.chips === 0,
      `${conDos.chips} → ${todos.chips} chips · ${todos.resultados} pensiones`
    );
    comprobar("sin filtros, el atajo de la barra desaparece", !todos.atajoQuitar);
    await navegador.capturar(join(CAPTURAS, "5-sin-filtros.png"));

    // ------------------------------------------- 3 · el panel devuelve el foco al cerrar
    console.log("\n3 · El panel se abre, se cierra y devuelve el foco");
    await navegador.evaluar(`(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      return "ok";
    })()`);
    await dormir(250);
    await navegador.evaluar(`document.querySelector(${JSON.stringify(BOTON_ABRIR)}).click(); "ok"`);
    await dormir(450);
    const abierto = await navegador.leer(`(() => {
      const p = document.querySelector("#panel-filtros");
      const r = p ? p.getBoundingClientRect() : null;
      return { visible: Boolean(p) && r.height > 0, alto: r ? Math.round(r.height * 10) / 10 : null };
    })()`);
    comprobar("el panel se abre a petición", abierto.visible, `alto desplegado: ${abierto.alto} px (${Math.round((abierto.alto / ALTO_MOVIL) * 100)} % de la pantalla)`);
    await navegador.capturar(join(CAPTURAS, "6-panel-abierto.png"));

    const cerrado = await navegador.evaluar(`(() => {
      const boton = document.querySelector(${JSON.stringify(BOTON_ABRIR)});
      const cerrar = [...document.querySelectorAll("#panel-filtros button")]
        .find((b) => /^Ver \\d+ pensi/.test(b.textContent.trim()));
      if (!cerrar) return "no encontré el botón de cerrar";
      cerrar.click();
      return boton === document.activeElement ? "foco en el botón" : "foco en " + (document.activeElement ? document.activeElement.tagName : "nada");
    })()`);
    comprobar("al cerrar, el foco queda en el botón que abrió el panel", cerrado === "foco en el botón", cerrado);

    // ------------------------------------------------------------------- resumen
    console.log("\nMedido");
    console.log(`  barra recogida, con la página desplazada:  ${pegada.altoBarra} px de ${ALTO_MOVIL} px (${Math.round((pegada.altoBarra / ALTO_MOVIL) * 1000) / 10} %)`);
    console.log(`  panel desplegado (si estuviera fijo):      ${abierto.alto} px (${Math.round((abierto.alto / ALTO_MOVIL) * 100)} %)`);
    console.log(`  catálogo de demostración:                  ${resultados} pensiones`);
    console.log(`  capturas:                                  ${CAPTURAS}`);

    console.log("\nLo que esta medición NO cubre");
    console.log("  · El gesto táctil real (dedo sobre la pantalla) y el rebote del desplazamiento: se mide con un navegador sin ventana, con ratón y teclado.");
    console.log("  · Motores distintos de Chromium (Safari de iOS, Firefox).");
    console.log("  · El aspecto subjetivo: las capturas están en la carpeta de arriba y las miras tú.");
  } finally {
    await navegador.cerrar();
  }

  console.log(fallos === 0 ? "\nTodo en verde.\n" : `\n${fallos} comprobación(es) en rojo.\n`);
  if (fallos > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nFALLO: ${error.message}`);
  if (/ECONNREFUSED|fetch failed/i.test(error.message)) {
    console.error(`¿Está el servidor en marcha en ${BASE}? (npm run build && npm start)`);
  }
  process.exitCode = 1;
});
