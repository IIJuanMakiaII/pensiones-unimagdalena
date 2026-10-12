/**
 * El encabezado y el cierre de sesión (dos defectos medidos en producción).
 *
 * DOS DEFECTOS, DOS CAUSAS, NINGUNA ALEATORIA
 * -------------------------------------------
 *  1. **405 al pulsar «Cerrar sesión».** `NextResponse.redirect` usa 307 por
 *     defecto, y 307 CONSERVA el método: el navegador repetía el POST contra la
 *     portada, que es una página y solo admite GET. Reproducido con el flujo
 *     completo —`POST /auth/signout` → 307 con `Location: /` → `POST /` → 405—,
 *     que es exactamente el error que se veía en pantalla. La sesión sí se
 *     cerraba: lo que se caía era la página de destino.
 *  2. **La cabecera no reflejaba la sesión.** El efecto que resuelve la identidad
 *     tenía las dependencias vacías, y el layout raíz **no se vuelve a montar** al
 *     navegar, así que la foto del primer render se quedaba para siempre:
 *     «Inicia sesión» sobre la propia cuenta —medido con la sesión de
 *     `juansmakia@gmail.com` viva en `/publicar`— y «Cerrar sesión» después de
 *     salir. `router.refresh()` no lo arregla: refresca el árbol del servidor y
 *     conserva el estado del cliente, que es donde vive esa foto.
 *
 * QUÉ COMPRUEBA ESTA PRUEBA Y QUÉ NO
 * ----------------------------------
 * Lee los dos archivos y fija la decisión: que la redirección lleva 303 explícito
 * y que el efecto depende de la ruta actual. Es el mismo recurso que ya usan otras
 * suites para decisiones que viven dentro del JSX (`lista-espera.prueba.ts`).
 *
 * Lo que **no** demuestra: que el navegador se comporte bien. Eso no se puede
 * medir desde aquí y se comprueba sirviendo la aplicación (bloque 2 del CI y, en
 * esta ronda, el flujo real contra el despliegue: 303 en vez de 307, y la cabecera
 * cambiando dentro de la misma sesión). **Esta prueba protege la causa; la
 * medición protege el efecto.** Ninguna de las dos sustituye a la otra.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

function leer(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), "utf8");
}

describe("cierre de sesión · la redirección no puede conservar el método", () => {
  const ruta = leer("app/auth/signout/route.ts");

  it("solo expone POST, para que un enlace externo no cierre la sesión", () => {
    assert.match(ruta, /export async function POST\(/);
    assert.doesNotMatch(ruta, /export async function GET\(/);
  });

  it("redirige con 303 explícito y no con el 307 que se pone solo", () => {
    // Si alguien quita ese 303, el navegador vuelve a repetir el POST contra la
    // portada y el usuario vuelve a ver el 405. Esta línea es el defecto entero.
    assert.match(ruta, /NextResponse\.redirect\(new URL\("\/", peticion\.url\), 303\)/);
  });
});

describe("encabezado · la sesión se resuelve en cada cambio de ruta", () => {
  const componente = leer("components/EntradaCuenta.tsx");

  it("lee la ruta actual", () => {
    assert.match(componente, /import \{ usePathname \} from "next\/navigation"/);
    assert.match(componente, /const ruta = usePathname\(\)/);
  });

  it("vuelve a mirar la sesión cuando la ruta cambia", () => {
    assert.match(componente, /\}, \[ruta, identidad\]\);/);
  });

  it("con cookie y sin identidad todavía, resuelve la sesión", () => {
    assert.match(componente, /if \(!hayCookie\) \{/);
    assert.match(componente, /if \(identidad\) return;/);
  });

  it("sin cookie devuelve la cabecera a visitante", () => {
    // Es la mitad que se olvida: sin esto, quien cierra sesión se queda viendo
    // «Cerrar sesión» en la portada.
    assert.match(componente, /if \(identidad\) setIdentidad\(null\);/);
  });

  it("no descarga el cliente de Supabase si no hay cookie", () => {
    // La salida temprana tiene que seguir siendo lo primero del efecto: es lo que
    // sostiene los 0 kB de JavaScript para el visitante anónimo.
    const cuerpoDelEfecto = componente.slice(componente.indexOf("useEffect(() => {"));
    const salida = cuerpoDelEfecto.indexOf("hayCookieDeSesion()");
    const importacion = cuerpoDelEfecto.indexOf('await import("@/utils/supabase/client")');
    assert.ok(salida > -1 && importacion > -1, "no se encontraron las dos piezas del efecto");
    assert.ok(salida < importacion, "la comprobación de la cookie debe ir antes de importar el cliente");
  });
});
