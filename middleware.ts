import { NextResponse, type NextRequest } from "next/server";
import { actualizarSesion } from "@/utils/supabase/middleware";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  esSupabaseConfigurado,
} from "@/lib/supabase/config";
// Regla única de la dirección (segura en el edge: no arrastra dependencias).
import {
  FORMATO_UUID,
  columnaDeIdentificador,
  normalizarIdentificador,
} from "@/lib/identificador";
import { DEMO_HABILITADA } from "@/lib/sitio";
import { IDS_SEMILLA } from "@/lib/datos.semilla";
// La misma normalización que usa la página para agrupar y para construir la
// dirección de un barrio. `lib/barrios.ts` solo arrastra `lib/pension.ts`, que a
// su vez no importa nada de runtime, así que es seguro en el edge.
import { slugDeBarrio } from "@/lib/barrios";

/**
 * Middleware del sitio.
 *
 * 1. **Fichas** (`/pensiones/<id>`): devuelve 404 real cuando la publicación no
 *    existe o está retirada.
 *    Por qué no basta con `notFound()` en la página: la ruta es ISR con
 *    `dynamicParams` abierto, así que Next genera las rutas desconocidas bajo
 *    demanda y **materializa el HTML del estado "no encontrada" con código 200**
 *    (verificado: aparece el archivo en `.next/server/app/pensiones/`). Para un
 *    buscador eso es un *soft 404*, y es justo lo que invalida un `sitemap.xml`.
 *    Comprobar aquí resuelve el código de estado antes de que la página se
 *    renderice, sin quitar el ISR ni el esqueleto de carga de la ficha.
 *    Ante cualquier fallo (red, timeout, Supabase caído) se deja pasar la
 *    petición: un problema de infraestructura nunca debe convertir una ficha
 *    legítima en un 404.
 *
 * 2. **Barrios** (`/barrios`, `/barrios/<barrio>`): lo mismo, y por la misma
 *    razón (tarea #71). Aquí el caso es más ancho: el barrio lo escribe el
 *    anfitrión a mano, así que cualquier cadena inventada —incluido «Otro», que
 *    es un marcador del formulario y no un barrio— producía una dirección que
 *    Next materializaba con 200 y `index, follow`. No es una ruta de más: es un
 *    número no acotado de direcciones del dominio anunciándose a Google sin nada
 *    que enseñar. Medido antes del arreglo: `/barrios`, `/barrios/otro` y
 *    `/barrios/page-e213e357b7bdb579` respondían 200 indexable, mientras los dos
 *    controles (`/pensiones/<uuid inexistente>` y `/ruta-inexistente-xyz`)
 *    respondían 404.
 *    No basta con `notFound()`: se probó primero en las dos páginas, siguiendo a
 *    la ficha, y **no cambia el código de estado**. Medido en la misma
 *    compilación: la ruta generada bajo demanda sigue respondiendo 200, con el
 *    HTML de «no encontrada» dentro del vuelo RSC y sin `<main>` en el cuerpo.
 *    El propio `sitemap.ts` ya daba por hecho este 404 —solo anuncia `/barrios`
 *    cuando hay barrios, «porque con cero barrios esa ruta responde 404»—, así
 *    que hasta ahora el sitio se contradecía consigo mismo.
 *
 * 3. **Rutas privadas** (`/publicar`, `/login`): refresco de sesión, como antes.
 */
export async function middleware(peticion: NextRequest) {
  const ruta = peticion.nextUrl.pathname;

  const ficha = /^\/pensiones\/([^/]+)\/?$/.exec(ruta);
  if (ficha) {
    const respuesta = await comprobarFichaPublica(peticion, ficha[1]);
    return respuesta ?? NextResponse.next();
  }

  // `/barrios` deja el grupo sin capturar (índice); `/barrios/<barrio>` lo llena.
  const barrios = /^\/barrios(?:\/([^/]+))?\/?$/.exec(ruta);
  if (barrios) {
    const respuesta = await comprobarBarrioPublico(barrios[1] ?? null);
    return respuesta ?? NextResponse.next();
  }

  if (!esSupabaseConfigurado()) {
    return NextResponse.next();
  }
  return actualizarSesion(peticion);
}

/** Cookie de sesión de Supabase (`sb-<ref>-auth-token[...]`). */
const COOKIE_SESION = /^sb-.*-auth-token/;

/**
 * `existe` con la dirección legible del anuncio (para redirigir los enlaces
 * antiguos) · `no-existe` · `error` (no se pudo comprobar).
 *
 * Nunca lanza: ante un fallo devuelve `error` y el llamador deja pasar la
 * petición. Un problema de infraestructura no puede convertir una ficha legítima
 * en un 404.
 */
async function buscarPensionPublica(
  identificador: string
): Promise<{ estado: "existe"; slug: string | null } | { estado: "no-existe" } | { estado: "error" }> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 1500);

  /**
   * La columna tiene que ser la correcta: preguntar por la columna `id` (uuid) con
   * una dirección legible no devuelve «cero filas», devuelve un **error de tipo**
   * de PostgreSQL, y este middleware lo interpreta como «no se pudo comprobar»
   * (deja pasar) → una ficha inexistente respondería 200 con el texto «no
   * encontrada», que es el *soft 404* que queremos evitar.
   */
  const columna = columnaDeIdentificador(identificador);

  try {
    const respuesta = await fetch(
      // Se trae el slug para poder redirigir un enlace antiguo a la dirección buena.
      `${SUPABASE_URL}/rest/v1/pensiones?select=id,slug&${columna}=eq.${encodeURIComponent(identificador)}&activa=eq.true&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
        signal: control.signal,
      }
    );

    if (!respuesta.ok) return { estado: "error" };
    const filas = (await respuesta.json()) as { slug?: string | null }[];
    if (!Array.isArray(filas) || filas.length === 0) return { estado: "no-existe" };
    return { estado: "existe", slug: filas[0]?.slug ?? null };
  } catch {
    return { estado: "error" };
  } finally {
    clearTimeout(temporizador);
  }
}

async function comprobarFichaPublica(
  peticion: NextRequest,
  identificador: string
): Promise<NextResponse | null> {
  if (!esSupabaseConfigurado()) return null;

  const valor = normalizarIdentificador(identificador);

  // Las fichas de ejemplo no viven en la base de datos: se eximen por LISTA
  // mientras el modo demostración esté encendido. Eximir «todo lo que no sea
  // UUID» sería un error — ninguna dirección se comprobaría y una ficha
  // inexistente respondería 200 con el texto «no encontrada».
  if (DEMO_HABILITADA && IDS_SEMILLA.includes(valor)) return null;

  const conSesion = peticion.cookies.getAll().some((cookie) => COOKIE_SESION.test(cookie.name));

  const resultado = await buscarPensionPublica(valor);
  if (resultado.estado === "error") return null;

  if (resultado.estado === "existe") {
    /**
     * Enlace antiguo (identificador interno) → redirección **permanente** a la
     * dirección legible.
     *
     * Se resuelve aquí y no en la página a propósito: la ficha tiene una frontera
     * de streaming (`loading.tsx`), así que cuando el componente se ejecuta la
     * cabecera 200 ya se envió y la redirección llegaría tarde — el enlace viejo
     * respondería 200 sirviendo el anuncio en la dirección equivocada (contenido
     * duplicado para los buscadores). Se atiende con sesión o sin ella, para que
     * el enlace funcione igual para todo el mundo.
     */
    if (FORMATO_UUID.test(valor) && resultado.slug) {
      return NextResponse.redirect(new URL(`/pensiones/${resultado.slug}`, peticion.url), 308);
    }
    return null;
  }

  // No existe. Un visitante con sesión puede ser el anfitrión, y su ficha
  // retirada tiene que seguir siendo visible para él.
  if (conSesion) return null;

  return new NextResponse(HTML_NO_ENCONTRADA, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "no-store",
    },
  });
}

/**
 * Los barrios que hoy tienen alguna publicación activa, ya normalizados a su
 * dirección legible · `error` = no se pudo comprobar.
 *
 * Nunca lanza: ante un fallo (red, timeout, Supabase caído) el llamador deja
 * pasar la petición, igual que en la ficha, porque un problema de infraestructura
 * no puede convertir una página legítima en un 404.
 *
 * Se normaliza con `slugDeBarrio`, la **misma** función con la que la página
 * agrupa y construye la dirección. Si aquí se normalizara distinto, el filtro y
 * la página discreparían, y el desacuerdo sería un 404 de más o —peor— una página
 * vacía servida con 200, que es justo el defecto que esto cierra.
 */
async function buscarBarriosPublicos(): Promise<
  { estado: "ok"; slugs: Set<string> } | { estado: "error" }
> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 1500);

  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/rest/v1/pensiones?select=barrio&activa=eq.true`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
        signal: control.signal,
      }
    );

    if (!respuesta.ok) return { estado: "error" };
    const filas = (await respuesta.json()) as { barrio?: string | null }[];
    if (!Array.isArray(filas)) return { estado: "error" };

    const slugs = new Set<string>();
    for (const fila of filas) {
      const slug = slugDeBarrio(fila.barrio ?? "");
      if (slug) slugs.add(slug);
    }
    return { estado: "ok", slugs };
  } catch {
    return { estado: "error" };
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * 404 real para las páginas de barrio sin nada que mostrar.
 *
 * `slug === null` es el índice, que solo existe si hay al menos un barrio
 * publicado. Con un barrio, se compara **tal cual** contra las direcciones
 * publicadas, sin normalizar el segmento que llega: la página decide con
 * `resumen.slug === barrio` sobre un slug que ya viene normalizado, así que
 * normalizar aquí una dirección que la página no reconocería abriría un hueco
 * —`/barrios/EL-PANDO` pasaría este filtro y luego respondería 200 vacío—.
 */
async function comprobarBarrioPublico(slug: string | null): Promise<NextResponse | null> {
  if (!esSupabaseConfigurado()) return null;

  const resultado = await buscarBarriosPublicos();
  if (resultado.estado === "error") return null;

  if (slug === null) {
    return resultado.slugs.size === 0 ? respuestaBarrioNoPublicado(true) : null;
  }
  return resultado.slugs.has(slug) ? null : respuestaBarrioNoPublicado(false);
}

/**
 * Respuesta 404 del edge para los barrios. Mismo criterio que el de la ficha: el
 * runtime del middleware no puede reutilizar los componentes de la aplicación,
 * así que el HTML va aquí, mínimo y sin dependencias. Si UX cambia estos textos,
 * hay que actualizarlos también aquí.
 *
 * Son **dos** respuestas y no una porque las dos situaciones no dicen lo mismo:
 * con inventario, `/barrios/<inventado>` no puede afirmar que no hay pensiones en
 * Santa Marta —las hay, en otros barrios—; sin inventario, el índice no puede
 * culpar a la dirección, que es la correcta.
 */
function respuestaBarrioNoPublicado(sinInventario: boolean): NextResponse {
  const titulo = sinInventario
    ? "Todavía no hay pensiones publicadas · Nido"
    : "Barrio sin pensiones publicadas · Nido";
  const encabezado = sinInventario
    ? "Todavía no hay pensiones publicadas por barrio"
    : "No hay pensiones publicadas en ese barrio";
  const parrafo = sinInventario
    ? "Las páginas de barrio solo existen cuando hay algo que mostrar. En cuanto un anfitrión publique cerca de Unimagdalena, aparecen solas."
    : "Las páginas de barrio solo existen cuando hay algo que mostrar. Puede que el nombre esté escrito de otra forma o que ese barrio todavía no tenga publicaciones.";

  // La casa dibujada, no el emoji: es la decisión que ya tomó el 404 del sitio
  // (tarea #56), y el emoji cambia de forma en cada plataforma.
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${titulo}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1.5rem; text-align: center; background: #FFFFFF; color: #222222; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      h1 { margin: 0; font-size: 1.5rem; }
      p { margin: 0; max-width: 34rem; line-height: 1.6; color: #717171; }
      a { display: inline-flex; min-height: 3rem; align-items: center; padding: 0 1.5rem; border-radius: 0.75rem; background: #E00B41; color: #fff; font-weight: 700; text-decoration: none; }
      a:hover { background: #C30036; }
    </style>
  </head>
  <body>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="48" height="48" aria-hidden="true" style="color:#D1D5DB">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.2V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.2" />
      <path d="M9.75 21v-5.5h4.5V21" />
    </svg>
    <h1>${encabezado}</h1>
    <p>${parrafo}</p>
    <a href="/">Ver las pensiones disponibles</a>
  </body>
</html>`,
    {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "noindex",
        "cache-control": "no-store",
      },
    }
  );
}

/**
 * Respuesta 404 del edge. Repite a propósito el copy del estado "no encontrada"
 * del sitio (misma promesa al usuario) en un HTML mínimo sin dependencias: el
 * runtime del middleware no puede reutilizar los componentes de la aplicación.
 * Si UX cambia ese texto, hay que actualizarlo también aquí.
 */
const HTML_NO_ENCONTRADA = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Pensión no encontrada · Nido</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1.5rem; text-align: center; background: #FFFFFF; color: #222222; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      h1 { margin: 0; font-size: 1.5rem; }
      p { margin: 0; max-width: 34rem; line-height: 1.6; color: #717171; }
      a { display: inline-flex; min-height: 3rem; align-items: center; padding: 0 1.5rem; border-radius: 0.75rem; background: #E00B41; color: #fff; font-weight: 700; text-decoration: none; }
      a:hover { background: #C30036; }
    </style>
  </head>
  <body>
    <span aria-hidden="true" style="font-size:3rem">🏠</span>
    <h1>Pensión no encontrada</h1>
    <p>Esa pensión no está en nuestro catálogo o ya no se publica. Vuelve al listado para ver las opciones disponibles cerca de Unimagdalena.</p>
    <a href="/">Ver todas las pensiones</a>
  </body>
</html>`;

export const config = {
  // `/maestro` entra aquí por la misma razón que `/publicar`: es una ruta con
  // sesión y el middleware es quien refresca la cookie antes de que la página la
  // lea. Sin esta entrada, el panel maestro se renderizaría con una sesión vieja
  // (o directamente sin sesión) y la comprobación del servidor fallaría por un
  // token caducado, no por permisos. La autorización no vive aquí: vive en la
  // página, que vuelve a preguntar por el perfil maestro a la base.
  // Los barrios entran por la misma razón que las fichas: su 404 lo tiene que
  // fijar alguien que responda antes que Next (ver la cabecera de este archivo).
  matcher: [
    "/publicar/:path*",
    "/maestro/:path*",
    "/maestro",
    "/login",
    "/pensiones/:path*",
    "/barrios",
    "/barrios/:path*",
  ],
};
