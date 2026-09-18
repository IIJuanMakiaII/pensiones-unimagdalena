/* Service Worker — Pensiones Unimagdalena (PWA)
 *
 * IMPORTANTE: este archivo solo debe registrarse en PRODUCCIÓN. En desarrollo
 * los archivos de `/_next/static/` no llevan hash de contenido, así que la
 * estrategia de caché serviría JavaScript viejo y la página se quedaría
 * colgada hasta recargar con Ctrl+Shift+R. El registro está condicionado en
 * `components/InstalarApp.tsx`.
 *
 * Estrategias:
 *  - Rutas privadas (/publicar, /login, /registro, /auth): SOLO red, sin caché.
 *  - Navegaciones públicas: red primero → caché → página /offline.
 *  - Estáticos propios (/_next/static, /iconos, /marca): caché primero.
 *  - Imágenes: stale-while-revalidate.
 *  - Resto del mismo origen: red con respaldo en caché.
 *
 * Todas las escrituras en caché verifican `respuesta.ok` para no guardar
 * páginas de error.
 */
const VERSION = "v3";
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

/** Rutas con datos de sesión: nunca se guardan en el dispositivo. */
const RUTAS_PRIVADAS = ["/publicar", "/login", "/registro", "/auth"];

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

const esRutaPrivada = (pathname) =>
  RUTAS_PRIVADAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));

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

  // 1) Navegaciones.
  if (solicitud.mode === "navigate") {
    // Las rutas con sesión no pasan por la caché: siempre red.
    if (esRutaPrivada(url.pathname)) return;

    evento.respondWith(
      fetch(solicitud)
        .then((respuesta) => guardarSiEsValida(CACHE_APP, solicitud, respuesta))
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

  // 4) Otros recursos del mismo origen (sin tocar rutas privadas).
  if (url.origin === self.location.origin && !esRutaPrivada(url.pathname)) {
    evento.respondWith(
      fetch(solicitud)
        .then((respuesta) => guardarSiEsValida(CACHE_ESTATICOS, solicitud, respuesta))
        .catch(() => caches.match(solicitud).then((respuesta) => respuesta || Response.error()))
    );
  }
});
