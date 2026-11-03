"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  SESION_MAXAGE_SEGUNDOS,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "@/lib/supabase/config";

/**
 * Cliente de Supabase para componentes de cliente (login, registro).
 *
 * `cookieOptions.maxAge` acota la vida de la cookie a 12 h (SEC-02). Sin él, la
 * librería la emite sin caducidad y el navegador la guarda 400 días.
 */
export function crearClienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: { maxAge: SESION_MAXAGE_SEGUNDOS },
  });
}
