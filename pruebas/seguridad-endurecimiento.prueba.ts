/**
 * Regresiones de los hallazgos SEC-02 a SEC-05 (auditoría del 3-nov-2026).
 *
 * Cada bloque corresponde a un hallazgo y falla si alguien deshace la
 * corrección. No prueban comportamiento de red: eso se verificó contra el
 * sitio desplegado y queda en `docs/auditorias/seguridad-correcciones-20261103.md`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { DESTINO_POR_DEFECTO, destinoInterno } from "@/lib/destino-seguro";
import { SESION_MAXAGE_SEGUNDOS } from "@/lib/supabase/config";

const ORIGEN = "https://pensiones-unimagdalena.vercel.app";

function fuente(ruta: string): string {
  return readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
}

describe("SEC-03 · redirección abierta en /auth/confirmar", () => {
  it("acepta una ruta interna normal", () => {
    assert.equal(destinoInterno("/publicar", ORIGEN), "/publicar");
    assert.equal(destinoInterno("/restablecer", ORIGEN), "/restablecer");
  });

  it("bloquea la barra invertida que el navegador lee como doble barra", () => {
    // El filtro viejo (`startsWith("/") && !startsWith("//")`) la dejaba pasar
    // y `new URL()` la resolvía a https://evil.com/.
    assert.equal(destinoInterno("/\\evil.com", ORIGEN), DESTINO_POR_DEFECTO);
    assert.equal(destinoInterno("/\\\\evil.com", ORIGEN), DESTINO_POR_DEFECTO);
    assert.equal(destinoInterno("/\\/evil.com", ORIGEN), DESTINO_POR_DEFECTO);
  });

  it("bloquea la doble barra y el dominio absoluto", () => {
    assert.equal(destinoInterno("//evil.com", ORIGEN), DESTINO_POR_DEFECTO);
    assert.equal(destinoInterno("https://evil.com", ORIGEN), DESTINO_POR_DEFECTO);
    assert.equal(destinoInterno("https://evil.com/publicar", ORIGEN), DESTINO_POR_DEFECTO);
  });

  it("bloquea esquemas que no son http(s)", () => {
    assert.equal(destinoInterno("javascript:alert(1)", ORIGEN), DESTINO_POR_DEFECTO);
    assert.equal(destinoInterno("data:text/html,<script>alert(1)</script>", ORIGEN), DESTINO_POR_DEFECTO);
  });

  it("sin destino, o con basura, cae al destino por defecto", () => {
    assert.equal(destinoInterno(null, ORIGEN), DESTINO_POR_DEFECTO);
    assert.equal(destinoInterno("", ORIGEN), DESTINO_POR_DEFECTO);
    assert.equal(destinoInterno("   ", ORIGEN), DESTINO_POR_DEFECTO);
  });

  it("conserva query y ancla de un destino interno", () => {
    assert.equal(destinoInterno("/restablecer?aviso=1#fin", ORIGEN), "/restablecer?aviso=1#fin");
  });

  it("acepta un destino absoluto del mismo origen, normalizado a ruta", () => {
    assert.equal(destinoInterno(`${ORIGEN}/publicar`, ORIGEN), "/publicar");
  });

  it("la ruta usa el módulo y no el filtro viejo", () => {
    const ruta = fuente("app/auth/confirmar/route.ts");
    assert.match(ruta, /destinoInterno\(/);
    assert.doesNotMatch(ruta, /startsWith\("\/\/"\)/);
  });
});

describe("SEC-02 · vida de la cookie de sesión", () => {
  it("doce horas, nunca más de un día", () => {
    assert.equal(SESION_MAXAGE_SEGUNDOS, 12 * 60 * 60);
    assert.ok(SESION_MAXAGE_SEGUNDOS <= 24 * 60 * 60);
  });

  it("los tres clientes de Supabase la aplican", () => {
    for (const ruta of [
      "utils/supabase/client.ts",
      "utils/supabase/server.ts",
      "utils/supabase/middleware.ts",
    ]) {
      const codigo = fuente(ruta);
      assert.match(codigo, /cookieOptions:\s*\{\s*maxAge:\s*SESION_MAXAGE_SEGUNDOS\s*\}/, ruta);
    }
  });

  it("no se fuerza `httpOnly`: rompería el refresco en el navegador", () => {
    // La razón está en docs/auditorias/seguridad-app-20261103.md §4. Si alguien
    // lo activa sin mover la autenticación al servidor, la sesión dejaría de
    // refrescarse y esta prueba lo recuerda.
    for (const ruta of ["utils/supabase/client.ts", "utils/supabase/server.ts"]) {
      assert.doesNotMatch(fuente(ruta), /httpOnly:\s*true/, ruta);
    }
  });
});

describe("SEC-04 · /maestro exige sesión", () => {
  it("está en la lista de rutas protegidas", () => {
    const codigo = fuente("utils/supabase/middleware.ts");
    assert.match(codigo, /RUTAS_PROTEGIDAS\s*=\s*\[[^\]]*"\/maestro"/);
  });

  it("el matcher del middleware la cubre", () => {
    const codigo = fuente("middleware.ts");
    assert.match(codigo, /"\/maestro"/);
    assert.match(codigo, /"\/maestro\/:path\*"/);
  });
});

describe("SEC-05 · sin datos personales en los registros", () => {
  it("el fallo de contacto registra código y mensaje, no el objeto entero", () => {
    const codigo = fuente("app/actions/contacto.ts");
    const linea = codigo
      .split("\n")
      .find((l) => l.includes("No se pudo guardar un contacto de respaldo"));
    assert.ok(linea, "se esperaba el registro del fallo");
    assert.match(linea, /error\.code/);
    assert.match(linea, /error\.message/);
    assert.doesNotMatch(linea, /:\s*error\)/);
  });
});

describe("SEC-01 · mitigación parcial del DoS de Server Actions", () => {
  it("el cuerpo de una Server Action está acotado", () => {
    const codigo = fuente("next.config.mjs");
    assert.match(codigo, /bodySizeLimit:\s*"\d+kb"/);
  });
});
