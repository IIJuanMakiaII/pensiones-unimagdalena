/**
 * Service Worker: que en el dispositivo no quede la página de nadie más.
 *
 * Este archivo **ejecuta `public/sw.js` de verdad**, con cachés falsas, y
 * observa qué se intenta guardar. No comprueba el texto del código: despacha
 * peticiones reales y mira si hubo escritura en alguna caché. Es la diferencia
 * entre «parece correcto» y «no guarda».
 *
 * El escenario que se está protegiendo: un computador compartido (una sala de
 * sistemas, un equipo prestado). Si el HTML de `/restablecer` o del panel queda
 * en el dispositivo, la siguiente persona lo ve al abrir el navegador.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CODIGO_SW = readFileSync(fileURLToPath(new URL("../public/sw.js", import.meta.url)), "utf8");

const ORIGEN = "https://pensiones.test";
const COOKIE_SESION = "sb-ayznnqkacpdvvufclhon-auth-token=base64-abc; otras=1";

interface Escritura {
  cache: string;
  url: string;
}

interface PeticionFalsa {
  method: string;
  url: string;
  mode: string;
  destination: string;
  headers: { get: (nombre: string) => string | null };
}

interface Entorno {
  navegar: (ruta: string, opciones?: { cookie?: string; destination?: string; metodo?: string }) => Promise<Escritura[]>;
  escrituras: Escritura[];
  borrados: string[];
  ejecutarActivate: () => Promise<void>;
}

/**
 * Monta un entorno mínimo con la superficie que usa el Service Worker:
 * `self` (con sus eventos), `caches`, `fetch` y `Response`.
 */
function montarEntorno(respuestaRed: { ok: boolean; status: number } = { ok: true, status: 200 }): Entorno {
  const escrituras: Escritura[] = [];
  const borrados: string[] = [];
  const manejadores: Record<string, (evento: unknown) => void> = {};

  const respuesta = {
    ok: respuestaRed.ok,
    status: respuestaRed.status,
    clone: () => respuesta,
  };

  const cacheFalsa = (nombre: string) => ({
    addAll: async () => undefined,
    put: async (solicitud: PeticionFalsa) => {
      escrituras.push({ cache: nombre, url: solicitud.url });
    },
    match: async () => undefined,
  });

  const cachesFalsas = {
    open: async (nombre: string) => cacheFalsa(nombre),
    match: async () => undefined,
    keys: async () => ["pensiones-app-v3", "pensiones-estaticos-v3", "pensiones-imagenes-v3"],
    delete: async (clave: string) => {
      borrados.push(clave);
      return true;
    },
  };

  const falsoSelf = {
    location: { origin: ORIGEN },
    addEventListener: (tipo: string, manejador: (evento: unknown) => void) => {
      manejadores[tipo] = manejador;
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };

  // `new Function` con parámetros: el Service Worker no importa nada, así que
  // se puede ejecutar tal cual inyectándole la superficie que espera.
  const fabrica = new Function("self", "caches", "fetch", "Response", CODIGO_SW);
  fabrica(falsoSelf, cachesFalsas, async () => respuesta, { error: () => respuesta });

  const manejadorFetch = manejadores["fetch"];
  if (!manejadorFetch) throw new Error("El Service Worker no registró el manejador de fetch");

  const navegar: Entorno["navegar"] = async (ruta, opciones = {}) => {
    const solicitud: PeticionFalsa = {
      method: opciones.metodo ?? "GET",
      url: new URL(ruta, ORIGEN).toString(),
      mode: "navigate",
      destination: opciones.destination ?? "document",
      headers: { get: (nombre: string) => (nombre.toLowerCase() === "cookie" ? opciones.cookie ?? null : null) },
    };

    const antes = escrituras.length;
    let respondida: Promise<unknown> | undefined;

    manejadorFetch({
      request: solicitud,
      respondWith: (promesa: Promise<unknown>) => {
        respondida = promesa;
      },
    });

    if (respondida) await respondida.catch(() => undefined);
    return escrituras.slice(antes);
  };

  const ejecutarActivate = async () => {
    const manejador = manejadores["activate"];
    if (!manejador) throw new Error("El Service Worker no registró el manejador de activate");
    const pendientes: Promise<unknown>[] = [];
    manejador({ waitUntil: (promesa: Promise<unknown>) => pendientes.push(promesa) });
    await Promise.all(pendientes);
  };

  return { navegar, escrituras, borrados, ejecutarActivate };
}

/** Rutas de cuenta: ninguna puede dejar rastro en el dispositivo. */
const RUTAS_DE_CUENTA = [
  "/publicar",
  "/publicar/f555e5b3-6629-402a-ae37-32c366c3f022/editar",
  "/login",
  "/login?destino=%2Fpublicar",
  "/registro",
  "/recuperar",
  "/restablecer",
  "/auth/confirmar?code=abc",
];

describe("Service Worker · ninguna página con sesión se guarda", () => {
  for (const ruta of RUTAS_DE_CUENTA) {
    it(`no guarda ${ruta}`, async () => {
      const entorno = montarEntorno();
      const escrituras = await entorno.navegar(ruta);
      assert.deepEqual(escrituras, [], `${ruta} no debería escribirse en ninguna caché`);
    });
  }

  it("no guarda la página de restablecer aunque venga con el parámetro de demostración", async () => {
    const entorno = montarEntorno();
    assert.deepEqual(await entorno.navegar("/restablecer?demo=1"), []);
  });

  it("una ruta nueva sin clasificar tampoco se guarda (el criterio falla cerrado)", async () => {
    const entorno = montarEntorno();
    assert.deepEqual(await entorno.navegar("/cuenta-futura"), []);
    assert.deepEqual(await entorno.navegar("/panel-de-anfitrion"), []);
  });
});

describe("Service Worker · la guarda de sesión no depende de ninguna lista", () => {
  it("no guarda una página pública si la petición trae cookie de sesión", async () => {
    const entorno = montarEntorno();
    const escrituras = await entorno.navegar("/", { cookie: COOKIE_SESION });
    assert.deepEqual(escrituras, [], "con sesión abierta no debe quedar HTML en el dispositivo");
  });

  it("tampoco la ficha, ni siquiera siendo pública", async () => {
    const entorno = montarEntorno();
    assert.deepEqual(await entorno.navegar("/pensiones/residencia-makia", { cookie: COOKIE_SESION }), []);
  });

  it("reconoce la cookie de Supabase troceada (…-auth-token.0)", async () => {
    const entorno = montarEntorno();
    const cookieTroceada = "sb-ayznnqkacpdvvufclhon-auth-token.0=parte1";
    assert.deepEqual(await entorno.navegar("/", { cookie: cookieTroceada }), []);
  });

  it("una cookie ajena al inicio no confunde la detección", async () => {
    const entorno = montarEntorno();
    const otras = "tema=oscuro; sb-ayznnqkacpdvvufclhon-auth-token=tal";
    assert.deepEqual(await entorno.navegar("/", { cookie: otras }), [], "la cookie puede no ir primera");
  });
});

describe("Service Worker · el catálogo sigue disponible sin conexión", () => {
  it("guarda la portada de un visitante sin sesión", async () => {
    const entorno = montarEntorno();
    const escrituras = await entorno.navegar("/");
    assert.equal(escrituras.length, 1);
    assert.ok(escrituras[0]!.cache.startsWith("pensiones-app-"));
  });

  it("guarda la portada con el parámetro de demostración", async () => {
    const entorno = montarEntorno();
    assert.equal((await entorno.navegar("/?demo=1")).length, 1);
  });

  it("guarda la ficha, los barrios, las guías y los textos legales", async () => {
    for (const ruta of ["/pensiones/residencia-makia", "/barrios", "/barrios/mamatoco", "/guias/como-elegir-pension-unimagdalena", "/legal/privacidad", "/legal/condiciones"]) {
      const entorno = montarEntorno();
      assert.equal((await entorno.navegar(ruta)).length, 1, `${ruta} debería poder guardarse`);
    }
  });
});

describe("Service Worker · nada más se guarda", () => {
  it("una respuesta de error no se guarda", async () => {
    const entorno = montarEntorno({ ok: false, status: 500 });
    assert.deepEqual(await entorno.navegar("/"), []);
  });

  it("una petición que no es GET no se toca", async () => {
    const entorno = montarEntorno();
    assert.deepEqual(await entorno.navegar("/", { metodo: "POST" }), []);
  });
});

describe("Service Worker · al actualizarse, borra las cachés anteriores", () => {
  it("descarta las cachés de la versión vieja (donde sí podía haber páginas con sesión)", async () => {
    const entorno = montarEntorno();
    await entorno.ejecutarActivate();
    assert.ok(entorno.borrados.includes("pensiones-app-v3"), "debe borrar la caché de aplicación anterior");
    assert.ok(entorno.borrados.includes("pensiones-estaticos-v3"));
    assert.ok(entorno.borrados.includes("pensiones-imagenes-v3"));
  });
});
