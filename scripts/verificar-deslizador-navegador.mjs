/**
 * El deslizador de precio no pide la página en cada paso (tarea #37).
 *
 * El catálogo se filtra **en el navegador**: la lista completa ya está en la
 * página. Pero la dirección se escribía con `router.replace(...)`, que en el App
 * Router no es «cambiar la dirección», es **navegar** — y una navegación le pide
 * al servidor el árbol entero de la página. Arrastrar el deslizador de un extremo
 * al otro emitía una petición por paso, y en el móvil se paga en cada gesto.
 *
 * Esto lo mide y lo deja medido: cuenta las peticiones **reales** que salen del
 * navegador al recorrer el control completo con el dedo simulado y con el teclado,
 * y exige que sean cero. Si alguien vuelve a meter una navegación ahí, esta
 * comprobación se pone en rojo con la cifra delante.
 *
 * Mide con el catálogo de demostración (`?demo=1`), así que no necesita la base de
 * datos ni credenciales. Requiere el servidor en marcha y un Chrome o Edge.
 *
 * Uso: npm run verificar:deslizador-navegador
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirNavegador, rutaDelNavegador } from "./navegador.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const URL_MEDICION = `${BASE}/?demo=1`;
const SELECTOR = "input#filtro-precio";

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

let fallos = 0;
const comprobar = (descripcion, condicion, detalle = "") => {
  const marca = condicion ? "✓" : "✗";
  console.log(`  ${marca} ${descripcion}${detalle ? ` — ${detalle}` : ""}`);
  if (!condicion) fallos += 1;
};

/**
 * Instala el contador. Solo cuenta las peticiones que van al servidor **por esta
 * página** (peticiones de árbol, RSC): deja fuera las del documento inicial, las
 * de analítica y los prefetch de las tarjetas, que no son el objeto de la medida.
 */
const INSTALAR_CONTADOR = `(() => {
  const contador = { pagina: 0, otras: 0 };
  const esDeLaPagina = (u) => {
    const s = String(u);
    if (s.indexOf("_rsc") === -1) return false;
    try {
      return new URL(s, location.href).pathname === location.pathname;
    } catch {
      return false;
    }
  };
  const fetchOriginal = window.fetch;
  window.fetch = function (...args) {
    const u = args[0] && args[0].url ? args[0].url : args[0];
    if (esDeLaPagina(u)) contador.pagina++; else contador.otras++;
    return fetchOriginal.apply(this, args);
  };
  const abrirOriginal = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (metodo, u, ...resto) {
    if (esDeLaPagina(u)) contador.pagina++; else contador.otras++;
    return abrirOriginal.call(this, metodo, u, ...resto);
  };
  window.__medicion = contador;
  return "instalado";
})()`;

const REINICIAR = `(() => {
  window.__medicion.pagina = 0;
  window.__medicion.otras = 0;
  return "reiniciado";
})()`;

const LEER = `JSON.stringify({
  pagina: window.__medicion.pagina,
  otras: window.__medicion.otras,
  salida: (() => {
    const o = document.querySelector("output");
    return o ? o.textContent.trim().replace(/\\s+/g, " ") : null;
  })(),
  resultados: document.querySelectorAll("article").length,
  url: location.search
})`;

/** Recorre el control de un extremo al otro como un arrastre continuo. */
const ARRASTRE = `(async () => {
  const entrada = document.querySelector(${JSON.stringify(SELECTOR)});
  const min = Number(entrada.min), max = Number(entrada.max), paso = Number(entrada.step) || 1;
  const poner = (v) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor.set.call(entrada, String(v));
    entrada.dispatchEvent(new Event("input", { bubbles: true }));
  };
  let pasos = 0;
  for (let v = max - paso; v >= min; v -= paso) { poner(v); pasos++; await new Promise((r) => setTimeout(r, 45)); }
  entrada.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));
  return JSON.stringify({ pasos: pasos });
})()`;

async function main() {
  console.log("\nDeslizador de precio: peticiones por arrastre completo");
  console.log(`  servidor: ${BASE}\n`);

  if (!rutaDelNavegador()) {
    console.log("  ✗ no encuentro Chrome ni Edge. Define CHROME_PATH para poder medir.");
    process.exitCode = 1;
    return;
  }

  const navegador = await abrirNavegador({ ancho: 1280, alto: 900 });

  try {
    await navegador.ir(URL_MEDICION, { esperarSelector: SELECTOR });
    await navegador.evaluar(INSTALAR_CONTADOR);

    const rango = await navegador.leer(`(() => {
      const e = document.querySelector(${JSON.stringify(SELECTOR)});
      return { min: Number(e.min), max: Number(e.max), paso: Number(e.step) || 1 };
    })()`);
    const pasos = Math.round((rango.max - rango.min) / rango.paso);

    // Línea base: sin tocar nada no puede salir ninguna petición. Si sale, la
    // medida mide ruido y no vale.
    await navegador.evaluar(REINICIAR);
    await dormir(1200);
    const base = JSON.parse(await navegador.evaluar(LEER));
    comprobar("en reposo no se emite ninguna petición a la página", base.pagina === 0, `${base.pagina} peticiones`);

    // --- dedo
    await navegador.evaluar(REINICIAR);
    const { pasos: recorridos } = JSON.parse(await navegador.evaluarConPromesa(ARRASTRE));
    const dedo = JSON.parse(await navegador.evaluar(LEER));
    comprobar(
      "arrastrar de un extremo al otro no pide la página",
      dedo.pagina === 0,
      `${recorridos} pasos → ${dedo.pagina} peticiones (antes del arreglo: una por paso)`
    );
    comprobar("el catálogo responde al control", dedo.resultados > 0, `${base.resultados} → ${dedo.resultados} pensiones · ${dedo.salida}`);
    comprobar("la dirección queda escrita con los filtros", dedo.url.includes("precio="), dedo.url);

    // --- teclado (recarga antes: así la caché del router no falsea la medida)
    await navegador.ir(URL_MEDICION, { esperarSelector: SELECTOR });
    await navegador.evaluar(INSTALAR_CONTADOR);
    await navegador.evaluar(`(() => {
      const e = document.querySelector(${JSON.stringify(SELECTOR)});
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor.set.call(e, String(Number(e.max)));
      e.dispatchEvent(new Event("input", { bubbles: true }));
      return "arriba";
    })()`);
    await navegador.enfocar(SELECTOR);
    await navegador.evaluar(REINICIAR);
    for (let i = 0; i < pasos; i++) {
      await navegador.pulsarTecla("ArrowLeft");
      await dormir(45);
    }
    await dormir(800);
    const teclado = JSON.parse(await navegador.evaluar(LEER));
    comprobar(
      "recorrerlo con el teclado tampoco pide la página",
      teclado.pagina === 0,
      `${pasos} pulsaciones → ${teclado.pagina} peticiones`
    );
    comprobar(
      "el teclado mueve el control de verdad",
      teclado.resultados > 0 && teclado.url.includes("precio="),
      `${teclado.resultados} pensiones · ${teclado.salida}`
    );
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
