import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Cliente de Supabase para Server Components y Server Actions.
 * La escritura de cookies se envuelve en try/catch porque los Server Components
 * no pueden escribir cookies (de eso se encarga el middleware).
 */
export function crearClienteServidor() {
  const almacen = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(nombre: string) {
        return almacen.get(nombre)?.value;
      },
      set(nombre: string, valor: string, opciones: CookieOptions) {
        try {
          almacen.set(nombre, valor, opciones);
        } catch {
          /* Llamado desde un Server Component: el middleware refresca la sesión. */
        }
      },
      remove(nombre: string, opciones: CookieOptions) {
        try {
          almacen.set(nombre, "", opciones);
        } catch {
          /* Idem. */
        }
      },
    },
  });
}
