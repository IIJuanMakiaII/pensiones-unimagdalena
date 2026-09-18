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

/** Nombre que se muestra cuando falta configuración. */
export const AVISO_SIN_SUPABASE =
  "Supabase aún no está configurado: agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local";
