import { NextResponse, type NextRequest } from "next/server";
import { actualizarSesion } from "@/utils/supabase/middleware";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  esSupabaseConfigurado,
} from "@/lib/supabase/config";

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

/** Los ids reales son UUID; los slugs pertenecen a la semilla de demostración. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Modo demostración: mientras esté encendido, las fichas de ejemplo son válidas. */
const DEMO_HABILITADA = process.env.NEXT_PUBLIC_MOSTRAR_DEMO === "1";

/**
 * `true` = existe · `false` = no existe · `null` = no se pudo comprobar.
 * Nunca lanza: devuelve `null` para que el llamador deje pasar la petición.
 */
async function existePensionPublica(id: string): Promise<boolean | null> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), 1500);

  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/rest/v1/pensiones?select=id&id=eq.${id}&activa=eq.true&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
        signal: control.signal,
      }
    );

    if (!respuesta.ok) return null;
    const filas: unknown = await respuesta.json();
    return Array.isArray(filas) && filas.length > 0;
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

async function comprobarFichaPublica(
  peticion: NextRequest,
  id: string
): Promise<NextResponse | null> {
  if (!esSupabaseConfigurado()) return null;

  // Los slugs de la semilla de demostración no viven en la base de datos: se
  // dejan pasar solo mientras el modo demostración esté encendido. Con la demo
  // apagada (producción) se comprueban como cualquier otro id, para que un slug
  // heredado no quede servido con 200 en el sitemap.
  if (!UUID.test(id) && DEMO_HABILITADA) return null;

  // Un visitante con sesión puede ser el anfitrión: su ficha retirada debe
  // seguir siendo visible para él, así que no se le bloquea ni se consulta.
  if (peticion.cookies.getAll().some((cookie) => COOKIE_SESION.test(cookie.name))) {
    return null;
  }

  const existe = await existePensionPublica(id);
  if (existe !== false) return null;

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
