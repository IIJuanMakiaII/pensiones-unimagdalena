import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Cliente anónimo SIN cookies, para lecturas públicas del catálogo.
 *
 * ¿Por qué un cliente aparte? El cliente con cookies convierte cada página en
 * dinámica (se renderiza en cada petición). Este no depende de la sesión, así
 * que sus consultas se pueden guardar en el Data Cache de Next con
 * `revalidate`: las páginas vuelven a ser estáticas ultrarrápidas (ISR) y se
 * refrescan cada 60 s o cuando una acción descarta su ruta (ver
 * `lib/cache-catalogo.ts`).
 *
 * RLS sigue protegiendo los datos: con la clave anónima solo se leen las
 * pensiones con `activa = true`.
 */
export function crearClientePublico() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (entrada: RequestInfo | URL, opciones?: RequestInit) =>
        fetch(entrada, {
          ...(opciones ?? {}),
          // Next lee `next` en tiempo de ejecución; el cast solo calma a TypeScript.
          // Sin etiqueta: al publicar se invalidan rutas, no etiquetas (M-22).
          next: { revalidate: 60 },
        } as RequestInit),
    },
  });
}
