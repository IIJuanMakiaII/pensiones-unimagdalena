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
 * 2. **Rutas privadas** (`/publicar`, `/login`): refresco de sesión, como antes.
 */
export async function middleware(peticion: NextRequest) {
  const ruta = peticion.nextUrl.pathname;

  const ficha = /^\/pensiones\/([^/]+)\/?$/.exec(ruta);
  if (ficha) {
    const respuesta = await comprobarFichaPublica(peticion, ficha[1]);
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
    <title>Pensión no encontrada · Pensiones Unimagdalena</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1.5rem; text-align: center; background: #FAFAF9; color: #292524; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      h1 { margin: 0; font-size: 1.5rem; }
      p { margin: 0; max-width: 34rem; line-height: 1.6; color: #57534E; }
      a { display: inline-flex; min-height: 3rem; align-items: center; padding: 0 1.5rem; border-radius: 0.75rem; background: #E16118; color: #fff; font-weight: 700; text-decoration: none; }
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
  matcher: ["/publicar/:path*", "/login", "/pensiones/:path*"],
};
