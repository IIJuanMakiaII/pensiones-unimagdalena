/**
 * Conductor de navegador para los verificadores.
 *
 * Abre un Chrome real (sin ventana), lo conduce por el protocolo de depuración
 * (CDP) y devuelve lo que midió la página: alto de un elemento, estado del foco,
 * resultados visibles, capturas. **No añade ninguna dependencia**: usa el
 * `WebSocket` que trae Node desde la versión 22 y habla el protocolo a mano.
 *
 * ¿Por qué existe? Varios verificadores del proyecto solo podían comprobar la
 * estructura declarada en el código —el alto calculado desde las clases, por
 * ejemplo— porque este entorno no tenía navegador. Eso deja fuera justo lo que el
 * fundador ve: si la barra tapa media pantalla, si un filtro se puede quitar con
 * resultados delante o si el foco se pierde al cerrar. Con esto se mide en el
 * navegador de verdad.
 *
 * Uso típico:
 *
 *   import { abrirNavegador } from "./navegador.mjs";
 *
 *   const navegador = await abrirNavegador({ ancho: 375, alto: 812 });
 *   try {
 *     await navegador.ir("http://127.0.0.1:3000/?demo=1", { esperarSelector: "article" });
 *     const alto = await navegador.evaluar("document.querySelector('article').offsetHeight");
 *     await navegador.capturar("tmp/captura.png");
 *   } finally {
 *     await navegador.cerrar();
 *   }
 *
 * El servidor no lo levanta este módulo: hay que tenerlo en marcha (`npm run
 * build && npm start` o `npm run dev`), igual que el resto de verificadores que
 * leen páginas. Y no necesita la base de datos ni credenciales: los verificadores
 * que lo usan cargan el catálogo de demostración (`?demo=1`), que es contenido
 * local, así que se pueden repetir con la base caída.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const PUERTO_DEPURACION = 9222;

/** Rutas habituales por plataforma; `CHROME_PATH` manda si está definido. */
const CANDIDATOS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  join(process.env.LOCALAPPDATA ?? "", "Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

/** El primero que exista, o `null` si no hay ninguno. */
export function rutaDelNavegador() {
  return CANDIDATOS.find((ruta) => ruta && existsSync(ruta)) ?? null;
}

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

async function encontrarPestana() {
  for (let intento = 0; intento < 60; intento++) {
    try {
      const respuesta = await fetch(`http://127.0.0.1:${PUERTO_DEPURACION}/json/list`);
      const objetivos = await respuesta.json();
      const pagina = objetivos.find((o) => o.type === "page" && o.webSocketDebuggerUrl);
      if (pagina) return pagina;
    } catch {
      /* todavía no levantó */
    }
    await dormir(250);
  }
  throw new Error("Chrome no publicó el puerto de depuración");
}

/** Cliente CDP mínimo sobre el WebSocket de Node. */
function conectar(url) {
  const ws = new WebSocket(url);
  const pendientes = new Map();
  let siguiente = 0;

  ws.addEventListener("message", (evento) => {
    const mensaje = JSON.parse(evento.data);
    const pendiente = mensaje.id ? pendientes.get(mensaje.id) : null;
    if (!pendiente) return;
    pendientes.delete(mensaje.id);
    if (mensaje.error) pendiente.rechazar(new Error(mensaje.error.message));
    else pendiente.resolver(mensaje.result);
  });

  const listo = new Promise((resolver, rechazar) => {
    ws.addEventListener("open", () => resolver());
    ws.addEventListener("error", () => rechazar(new Error("no se pudo abrir el WebSocket de CDP")));
  });

  return {
    listo,
    enviar(method, params = {}) {
      const id = ++siguiente;
      return new Promise((resolver, rechazar) => {
        pendientes.set(id, { resolver, rechazar });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    cerrar() {
      ws.close();
    },
  };
}

/**
 * Abre el navegador y devuelve el mando.
 *
 * @param {{ancho?: number, alto?: number, ruta?: string}} opciones
 */
export async function abrirNavegador({ ancho = 375, alto = 812, ruta } = {}) {
  const ejecutable = ruta ?? rutaDelNavegador();
  if (!ejecutable) {
    throw new Error(
      "no encuentro Chrome ni Edge. Define CHROME_PATH con la ruta del ejecutable para poder medir en un navegador."
    );
  }

  const chrome = spawn(
    ejecutable,
    [
      "--headless=new",
      `--remote-debugging-port=${PUERTO_DEPURACION}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), "navegador-"))}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-extensions",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const pestana = await encontrarPestana();
  const cdp = conectar(pestana.webSocketDebuggerUrl);
  await cdp.listo;
  await cdp.enviar("Page.enable");
  await cdp.enviar("Runtime.enable");
  await cdp.enviar("DOM.enable");
  // En headless la página se cree sin foco, y sin foco ni `focus()` ni las
  // pulsaciones de teclado llegan a ninguna parte.
  await cdp.enviar("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp.enviar("Emulation.setDeviceMetricsOverride", {
    width: ancho,
    height: alto,
    deviceScaleFactor: 1,
    mobile: true,
  });

  /** Evalúa una expresión y devuelve su valor. */
  async function evaluar(expresion) {
    const resultado = await cdp.enviar("Runtime.evaluate", {
      expression: expresion,
      returnByValue: true,
    });
    if (resultado.exceptionDetails) {
      throw new Error(`la página lanzó: ${resultado.exceptionDetails.text}`);
    }
    return resultado.result.value;
  }

  return {
    ancho,
    alto,

    /** Evalúa esperando promesas (para guiones con `await` dentro). */
    async evaluarConPromesa(expresion) {
      const resultado = await cdp.enviar("Runtime.evaluate", {
        expression: expresion,
        awaitPromise: true,
        returnByValue: true,
      });
      if (resultado.exceptionDetails) {
        throw new Error(`la página lanzó: ${resultado.exceptionDetails.text}`);
      }
      return resultado.result.value;
    },

    /** Lo mismo que `evaluar`, pero devolviendo ya el JSON parseado. */
    async leer(expresion) {
      return JSON.parse(await evaluar(`JSON.stringify(${expresion})`));
    },

    evaluar,

    /**
     * Navega y espera a que exista un selector (o a que pase el tiempo máximo).
     * La espera es necesaria porque Next hidrata después de servir el HTML.
     */
    async ir(url, { esperarSelector = null, maximoMs = 20000, asentarMs = 1200 } = {}) {
      await cdp.enviar("Page.navigate", { url });
      const limite = Date.now() + maximoMs;
      while (esperarSelector && Date.now() < limite) {
        await dormir(250);
        try {
          const hay = await evaluar(`Boolean(document.querySelector(${JSON.stringify(esperarSelector)}))`);
          if (hay) break;
        } catch {
          /* la página todavía está cargando */
        }
      }
      await dormir(asentarMs);
    },

    /** Pulsa una tecla de verdad (los eventos sintéticos no mueven un control nativo). */
    async pulsarTecla(key) {
      const codigos = {
        ArrowLeft: 37,
        ArrowRight: 39,
        ArrowUp: 38,
        ArrowDown: 40,
        Enter: 13,
        Tab: 9,
        Escape: 27,
      };
      const codigo = codigos[key];
      if (!codigo) throw new Error(`tecla no soportada: ${key}`);
      for (const tipo of ["keyDown", "keyUp"]) {
        await cdp.enviar("Input.dispatchKeyEvent", {
          type: tipo,
          key,
          code: key,
          windowsVirtualKeyCode: codigo,
          nativeVirtualKeyCode: codigo,
        });
      }
    },

    /** Enfoca un elemento desde el protocolo (no desde la página). */
    async enfocar(selector) {
      const documento = await cdp.enviar("DOM.getDocument", { depth: -1 });
      const nodo = await cdp.enviar("DOM.querySelector", {
        nodeId: documento.root.nodeId,
        selector,
      });
      if (!nodo.nodeId) throw new Error(`no encontré ${selector} para enfocar`);
      await cdp.enviar("DOM.focus", { nodeId: nodo.nodeId });
    },

    /** Guarda una captura de la ventana tal como está. */
    async capturar(ruta) {
      const { data } = await cdp.enviar("Page.captureScreenshot", { format: "png" });
      mkdirSync(dirname(ruta), { recursive: true });
      writeFileSync(ruta, Buffer.from(data, "base64"));
      return ruta;
    },

    async cerrar() {
      cdp.cerrar();
      chrome.kill();
    },
  };
}
