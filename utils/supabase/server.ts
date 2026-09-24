import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Cliente de Supabase para Server Components y Server Actions.
 *
 * Es `async` porque `cookies()` devuelve una promesa: Next lo cambió a
 * asíncrono en la versión 15 y en la 16 ya no admite el uso síncrono, así que
 * esperarlo es lo único que compila en ambas. En la versión 14 —donde todavía
 * devuelve el almacén directamente— el `await` no altera nada: esperar un valor
 * que no es una promesa lo devuelve tal cual. Por eso el cambio es seguro aquí y
 * levanta el bloqueo de la actualización (M-21) sin migrar todavía.
 *
 * La escritura de cookies se envuelve en try/catch porque los Server Components
 * no pueden escribir cookies (de eso se encarga el middleware).
 */
export async function crearClienteServidor() {
  const almacen = await cookies();

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
