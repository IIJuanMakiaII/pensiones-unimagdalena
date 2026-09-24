import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";

/** Cierre de sesión. Solo POST: evita que un enlace externo cierre la sesión. */
export async function POST(peticion: NextRequest) {
  if (esSupabaseConfigurado()) {
    const supabase = await crearClienteServidor();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", peticion.url));
}
