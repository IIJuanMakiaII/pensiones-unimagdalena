import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";

/** Cierre de sesión. Solo POST: evita que un enlace externo cierre la sesión. */
export async function POST(peticion: NextRequest) {
  if (esSupabaseConfigurado()) {
    const supabase = await crearClienteServidor();
    await supabase.auth.signOut();
  }
  /*
   * 303 y no el 307 que `NextResponse.redirect` pone por defecto.
   *
   * 307 —y 308— CONSERVAN el método: el navegador repetía el POST contra la
   * portada, que es una página y solo admite GET, así que el cierre de sesión
   * —que sí cerraba la sesión— terminaba en un 405 delante del usuario. Medido en
   * producción con el flujo completo: `POST /auth/signout` → 307 con
   * `Location: /` → `POST /` → 405, que es el error que se veía al pulsar
   * «Cerrar sesión». 303 See Other obliga a seguir la redirección con GET, que es
   * justo lo que la portada espera.
   */
  return NextResponse.redirect(new URL("/", peticion.url), 303);
}
