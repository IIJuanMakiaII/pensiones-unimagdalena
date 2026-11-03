/**
 * Configuración de Supabase (Agente 3 — integración dinámica).
 *
 * La app funciona en dos modos:
 *  1. MODO DINÁMICO: hay credenciales en .env.local → los datos salen de Supabase.
 *  2. MODO DEMO: no hay credenciales → se usa el catálogo semilla local
 *     (lib/datos.semilla.ts) para que el sitio siga funcionando sin romperse.
 *
 * Ver docs/integracion-supabase.md
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Comprueba que las credenciales tengan forma válida (evita fallos silenciosos). */
export function esSupabaseConfigurado(): boolean {
  return (
    /^https?:\/\/.+/.test(SUPABASE_URL) &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("tu-")
  );
}

/**
 * Vida máxima de la cookie de sesión, en segundos (SEC-02).
 *
 * `@supabase/ssr` no fija `maxAge` y el navegador interpreta entonces la cookie
 * como persistente: 400 días. Con `httpOnly: false` —que la librería necesita
 * para refrescar la sesión en el cliente— eso significa que una cookie robada
 * sirve durante más de un año.
 *
 * Doce horas acota la ventana sin cambiar el modelo de sesión: mientras la
 * pestaña esté en uso, el middleware refresca la cookie en cada petición, así
 * que el usuario activo no nota nada. Lo que cambia es que una sesión
 * abandonada deja de ser válida al día siguiente, en vez de al año.
 *
 * No se pone `httpOnly: true`: rompería el refresco en el navegador
 * (`createBrowserClient` lee la cookie). Está razonado en
 * `docs/auditorias/seguridad-app-20261103.md` §4.
 */
export const SESION_MAXAGE_SEGUNDOS = 12 * 60 * 60;

/** Nombre que se muestra cuando falta configuración. */
export const AVISO_SIN_SUPABASE =
  "Supabase aún no está configurado: agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local";
