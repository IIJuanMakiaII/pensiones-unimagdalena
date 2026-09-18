import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/** Rutas que exigen sesión activa de anfitrión. */
const RUTAS_PROTEGIDAS = ["/publicar"];

/**
 * Refresca la sesión de Supabase en cada petición y protege las rutas privadas.
 * Patrón oficial de @supabase/ssr para Next.js App Router.
 */
export async function actualizarSesion(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: { headers: peticion.headers } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(nombre: string) {
        return peticion.cookies.get(nombre)?.value;
      },
      set(nombre: string, valor: string, opciones: CookieOptions) {
        peticion.cookies.set({ name: nombre, value: valor, ...opciones });
        respuesta = NextResponse.next({ request: { headers: peticion.headers } });
        respuesta.cookies.set({ name: nombre, value: valor, ...opciones });
      },
      remove(nombre: string, opciones: CookieOptions) {
        peticion.cookies.set({ name: nombre, value: "", ...opciones });
        respuesta = NextResponse.next({ request: { headers: peticion.headers } });
        respuesta.cookies.set({ name: nombre, value: "", ...opciones });
      },
    },
  });

  // Si Supabase no responde, no se puede verificar la sesión: se trata como
  // "sin sesión" (y se redirige a /login) en lugar de devolver un error 500 que
  // dejaría al anfitrión sin poder entrar.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("No se pudo verificar la sesión en el middleware:", error);
  }

  const requiereSesion = RUTAS_PROTEGIDAS.some((ruta) => peticion.nextUrl.pathname.startsWith(ruta));

  if (requiereSesion && !user) {
    const destino = new URL("/login", peticion.url);
    destino.searchParams.set("destino", peticion.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  // Un anfitrión con sesión no necesita volver al login.
  if (user && peticion.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/publicar", peticion.url));
  }

  return respuesta;
}
