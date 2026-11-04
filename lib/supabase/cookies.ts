import type { CookieOptions } from "@supabase/ssr";

import { SESION_MAXAGE_SEGUNDOS } from "@/lib/supabase/config";

/**
 * Opciones efectivas de la cookie de sesión (SEC-02).
 *
 * `@supabase/ssr@0.12.7` **no respeta** `cookieOptions.maxAge`: mezcla lo que le
 * pasas y después escribe su propio valor (`dist/main/cookies.js:470`, con
 * `DEFAULT_COOKIE_OPTIONS.maxAge = 400 * 24 * 60 * 60`). Pasar la opción al
 * constructor no cambia nada — se comprobó en la primera corrección, que salió
 * con 400 días igual que antes.
 *
 * La única forma de que la cabecera `Set-Cookie` salga con 12 h es reescribir la
 * opción en el último momento, cuando la librería ya ha decidido y solo queda
 * entregarla al almacén de cookies. Eso es lo que hace esta función, y por eso
 * los tres clientes escriben a través de ella.
 *
 * Nota: al navegador le queda una ventana de 400 días hasta el primer refresco
 * del middleware —el `createBrowserClient` escribe la cookie él mismo y no
 * expone callback—, pero cualquier petición posterior la reescribe con 12 h.
 * Cerrarlo del todo exige mover el inicio de sesión a una Server Action, que es
 * la fase 2 documentada en `docs/auditorias/seguridad-correcciones-20261103.md`.
 */
export function opcionesDeCookieDeSesion(opciones: CookieOptions): CookieOptions {
  return { ...opciones, maxAge: SESION_MAXAGE_SEGUNDOS };
}

/** Almacén mínimo que necesita el adaptador de Supabase para escribir. */
export interface AlmacenDeCookies {
  set(nombre: string, valor: string, opciones: CookieOptions): void;
}

/**
 * Escribe una cookie de sesión con la vida ya forzada.
 *
 * Existe para que los dos escritores (Server Components y middleware) compartan
 * el mismo punto de control: si alguien vuelve a confiar en `cookieOptions`,
 * la prueba de comportamiento lo detecta.
 */
export function escribirCookieDeSesion(
  almacen: AlmacenDeCookies,
  nombre: string,
  valor: string,
  opciones: CookieOptions,
): void {
  almacen.set(nombre, valor, opcionesDeCookieDeSesion(opciones));
}
