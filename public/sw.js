/* Service Worker — Pensiones Unimagdalena (PWA)
 *
 * IMPORTANTE: este archivo solo debe registrarse en PRODUCCIÓN. En desarrollo
 * los archivos de `/_next/static/` no llevan hash de contenido, así que la
 * estrategia de caché serviría JavaScript viejo y la página se quedaría
 * colgada hasta recargar con Ctrl+Shift+R. El registro está condicionado en
 * `components/InstalarApp.tsx`.
 *
 * REGLA DE ORO (tarea #32 · M-17): en este dispositivo no se guarda **ninguna**
 * página que dependa de una sesión. En un equipo compartido —una sala de
 * sistemas, un computador prestado— servir el HTML de otra persona significa
 * ver su panel, o su pantalla de restablecer contraseña.
 *
 * Antes esto se resolvía con una lista de rutas privadas escrita a mano, y esa
 * lista se quedó atrás dos veces (la última: `/recuperar` y `/restablecer`
 * existían sin estar declaradas). Por eso el criterio está invertido:
 *
 *   1. `RUTAS_CACHEABLES` es una lista BLANCA. Lo que no está aquí no se
 *      guarda nunca: olvidarse de añadir una ruta privada es inofensivo.
 *      Olvidarse de una pública solo cuesta funcionalidad sin conexión.
 *   2. `RUTAS_CON_SESION` documenta las rutas de cuenta. Se declaran para que
 *      la comprobación automática pueda exigir que **toda** ruta esté
 *      clasificada, y que ninguna de estas sea cacheable.
 *   3. Además, y como red de seguridad independiente de las listas: si la
 *      petición trae cookie de sesión, no se guarda nada, ni siquiera en una
 *      ruta pública.
 *
 * `scripts/verificar-sw.mjs` recorre las rutas reales del build y **falla** si
 * alguna no está clasificada; `pruebas/service-worker.prueba.ts` ejecuta este
 * archivo con cachés falsas y comprueba que una página con sesión nunca se
 * guarda. Ninguna de las dos cosas es un comentario pidiendo cuidado.
 *
 * Estrategias:
 *  - Rutas con sesión: SOLO red. Ni lectura ni escritura de caché.
 *  - Navegaciones públicas: red primero → caché → página /offline.
 *  - Estáticos propios (/_next/static, /iconos, /marca): caché primero.
 *  - Imágenes: stale-while-revalidate.
 *  - Resto del mismo origen: red con respaldo en caché.
 *
 * Todas las escrituras en caché verifican `respuesta.ok` para no guardar
 * páginas de error.
 */
const VERSION = "v4";
const CACHE_APP = `pensiones-app-${VERSION}`;
const CACHE_ESTATICOS = `pensiones-estaticos-${VERSION}`;
const CACHE_IMAGENES = `pensiones-imagenes-${VERSION}`;

const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/iconos/icon-192.png",
  "/iconos/icon-512.png",
  "/iconos/icon-maskable-512.png",
  "/iconos/apple-touch-icon.png",
  "/iconos/favicon-48.png",
];

/**
 * Lista BLANCA: lo único que puede guardarse en el dispositivo. Son páginas
 * idénticas para todo el mundo (catálogo, barrios, guías y textos legales).
 *
 * Esta lista y `RUTAS_CON_SESION` las verifica `scripts/verificar-sw.mjs`
 * contra las rutas reales del build: si aparece una ruta que no esté en
 * ninguna de las dos, la comprobación falla.
 */
const RUTAS_CACHEABLES = ["/", "/pensiones", "/barrios", "/guias", "/legal", "/offline"];

/**
 * Rutas de cuenta: nunca entran en ninguna caché, ni como respaldo sin
 * conexión. `/auth` cubre los manejadores de confirmación y cierre de sesión.
 */
const RUTAS_CON_SESION = [
  "/publicar",
  "/login",
  "/registro",
  "/recuperar",
  "/restablecer",
  "/auth",
];

/**
 * Cookie de sesión de Supabase (`@supabase/ssr`). Puede venir troceada
 * (`…-auth-token.0`, `.1`), por eso se comprueba el prefijo y no el nombre
 * exacto: el nombre depende del identificador del proyecto.
 */
const COOKIE_SESION = /(^|;\s*)sb-[^=;]*auth-token/i;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_APP)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  const vigentes = [CACHE_APP, CACHE_ESTATICOS, CACHE_IMAGENES];
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves.filter((clave) => !vigentes.includes(clave)).map((clave) => caches.delete(clave))
        )
      )
      .then(() => self.clients.claim())
  );
});

const esEstaticoPropio = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/iconos/") ||
    url.pathname.startsWith("/marca/"));

/**
 * Coincidencia por segmento: `/pensiones` cubre `/pensiones/lo-que-sea` pero no
 * `/pensiones-x`… y `/` cubre **solo** `/`, nunca el resto del sitio. Esa
 * distinción es la que evita que la portada convierta en cacheable todo lo que
 * cuelga de la raíz.
 */
const coincideRuta = (pathname, ruta) =>
  pathname === ruta || (ruta !== "/" && pathname.startsWith(`${ruta}/`));

const esRutaConSesion = (pathname) =>
  RUTAS_CON_SESION.some((ruta) => coincideRuta(pathname, ruta));

const esRutaCacheable = (pathname) =>
  RUTAS_CACHEABLES.some((ruta) => coincideRuta(pathname, ruta));

/**
 * ¿Esta petición puede dejar su respuesta en el dispositivo?
 *
 * Dos condiciones, y las dos son necesarias: la ruta tiene que estar en la
 * lista blanca, y la petición no puede traer sesión. Lo segundo no depende de
 * ninguna lista, así que sigue protegiendo aunque alguien añada una página
 * personalizada y se olvide de declararla.
 */
function puedeGuardarse(solicitud, pathname) {
  if (!esRutaCacheable(pathname)) return false;
  const cookie = solicitud.headers.get("cookie");
  return !(cookie && COOKIE_SESION.test(cookie));
}

/** Guarda en caché solo respuestas correctas. */
function guardarSiEsValida(nombreCache, solicitud, respuesta) {
  if (!respuesta || !respuesta.ok) return respuesta;
  const copia = respuesta.clone();
  caches.open(nombreCache).then((cache) => cache.put(solicitud, copia));
  return respuesta;
}

self.addEventListener("fetch", (evento) => {
  const solicitud = evento.request;
  if (solicitud.method !== "GET") return;

  const url = new URL(solicitud.url);

  // 0) Rutas de cuenta: ni se leen ni se escriben en caché.
  if (esRutaConSesion(url.pathname)) return;

  // 1) Navegaciones.
  if (solicitud.mode === "navigate") {
    evento.respondWith(
      fetch(solicitud)
        .then((respuesta) =>
          puedeGuardarse(solicitud, url.pathname)
            ? guardarSiEsValida(CACHE_APP, solicitud, respuesta)
            : respuesta
        )
        .catch(() =>
          caches
            .match(solicitud)
            .then((enCache) => enCache || caches.match("/offline"))
            .then((respuesta) => respuesta || Response.error())
        )
    );
    return;
  }

  // 2) Estáticos propios: caché primero (en producción los nombres llevan hash).
  // No son páginas ni llevan datos de nadie: no necesitan la guarda de sesión.
  if (esEstaticoPropio(url)) {
    evento.respondWith(
      caches.match(solicitud).then(
        (enCache) =>
          enCache ||
          fetch(solicitud).then((respuesta) => guardarSiEsValida(CACHE_ESTATICOS, solicitud, respuesta))
      )
    );
    return;
  }

  // 3) Imágenes remotas: stale-while-revalidate.
  if (solicitud.destination === "image") {
    evento.respondWith(
      caches.open(CACHE_IMAGENES).then((cache) =>
        cache.match(solicitud).then((enCache) => {
          const red = fetch(solicitud)
            .then((respuesta) => {
              if (respuesta.ok || respuesta.type === "opaque") cache.put(solicitud, respuesta.clone());
              return respuesta;
            })
            .catch(() => enCache);
          return enCache || red;
        })
      )
    );
    return;
  }

  // 4) Otros recursos del mismo origen. Pasa por la misma guarda que las
  // navegaciones: aquí viajan los datos que el navegador pide al cambiar de
  // ruta, y también pueden depender de la sesión.
  if (url.origin === self.location.origin) {
    evento.respondWith(
      fetch(solicitud)
        .then((respuesta) =>
          puedeGuardarse(solicitud, url.pathname)
            ? guardarSiEsValida(CACHE_ESTATICOS, solicitud, respuesta)
            : respuesta
        )
        .catch(() => caches.match(solicitud).then((respuesta) => respuesta || Response.error()))
    );
  }
});
