/**
 * Sustituto de `next/headers` para las pruebas unitarias.
 *
 * Por qué existe: `utils/supabase/server.ts` importa `cookies()` de `next/headers`,
 * y ese especificador no lo resuelve Node —`next` es un paquete de Next, no un
 * paquete de Node, y su resolución ESM falla con `ERR_MODULE_NOT_FOUND`—. Mientras
 * ninguna prueba importara un módulo que llegue hasta ahí, el problema estaba
 * escondido. La prueba del panel maestro (tarea #34) sí lo hace, porque conduce la
 * función **real** `resolverPension`/`resolverPensionConSesion` en vez de leer el
 * código, y esa es justamente la diferencia que la tarea exige.
 *
 * Qué hace: nada, a propósito. Ninguna prueba unitaria debe abrir una conexión con
 * la base ni leer cookies reales; las lecturas se conducen con el lector inyectado
 * que `lib/datos.ts` acepta para las pruebas. Si algo llegara a llamar a estas
 * funciones, el error es explícito en vez de un fallo confuso más adelante — es
 * una frontera, no un simulacro silencioso.
 */

const MENSAJE =
  "Las pruebas unitarias no tienen un contexto de petición de Next: `cookies()`/`headers()` " +
  "no están disponibles. Si necesitas conducir una lectura, inyecta el lector por el " +
  "parámetro `cliente` de lib/datos.ts en lugar de construir el cliente del servidor.";

export function cookies() {
  throw new Error(MENSAJE);
}

export function headers() {
  throw new Error(MENSAJE);
}

export function draftMode() {
  throw new Error(MENSAJE);
}
