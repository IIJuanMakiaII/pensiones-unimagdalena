import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/utils/supabase/server";

/**
 * Destino al que apunta el enlace de los correos de Supabase (confirmación de
 * cuenta, recuperación de contraseña, cambio de correo).
 *
 * Con el flujo PKCE el enlace trae un `code` que hay que canjear por una sesión;
 * eso es lo que se hace aquí, en el servidor, para que las cookies queden bien
 * puestas antes de redirigir. Sin este paso el usuario llega a la página de
 * destino sin sesión y ve «enlace caducado» aunque su enlace fuera válido.
 *
 * `next` decide a dónde va después: `/restablecer` para la recuperación de
 * contraseña, `/publicar` para el resto.
 */
export async function GET(peticion: NextRequest) {
  const url = new URL(peticion.url);
  const codigo = url.searchParams.get("code");
  const destino = url.searchParams.get("next") ?? "/publicar";

  // Solo rutas internas: sin esto, `?next=//evil.com` sería una redirección
  // abierta hacia un dominio ajeno.
  const destinoSeguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/publicar";

  if (codigo) {
    try {
      const supabase = await crearClienteServidor();
      const { error } = await supabase.auth.exchangeCodeForSession(codigo);
      if (!error) return NextResponse.redirect(new URL(destinoSeguro, url.origin));
    } catch (error) {
      console.error("Error canjeando el código del enlace:", error);
    }
  }

  // Enlace caducado, ya usado o manipulado: se explica y se ofrece la salida.
  return NextResponse.redirect(new URL("/login?aviso=enlace", url.origin));
}
