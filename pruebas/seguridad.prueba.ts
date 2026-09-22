/**
 * Regresiones de seguridad que hoy solo se comprobaban a mano.
 *
 *  1. `serializarJsonLd` — el XSS almacenado que se corrigió en la Oleada 0. Si
 *     alguien vuelve a usar `JSON.stringify` directo para los datos
 *     estructurados, esta prueba falla: el texto lo publica un anfitrión y el
 *     script se ejecutaría en el dominio de la marca, para todos los visitantes.
 *  2. `hostImagenPermitido` — la lista blanca del optimizador de imágenes. Si se
 *     afloja (el viejo `hostname: "**"` convertía el optimizador en un proxy
 *     abierto), estas pruebas lo detectan.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hostImagenPermitido } from "@/lib/imagenes";
import { serializarJsonLd } from "@/lib/json-ld";

describe("serializarJsonLd · XSS almacenado", () => {
  it("neutraliza el cierre de etiqueta en un texto publicado por el anfitrión", () => {
    const ataque = { name: "</script><script>alert(1)</script>" };
    const salida = serializarJsonLd(ataque);

    assert.equal(salida.includes("</script"), false, "no puede quedar un cierre de script literal");
    assert.equal(salida.includes("<script"), false);
    assert.ok(salida.includes("\\u003c/script\\u003e"));
  });

  it("escapa también «>», «&» y los separadores U+2028/U+2029", () => {
    const salida = serializarJsonLd({ a: "a > b & c", b: `linea\u2028rara\u2029fin` });
    assert.equal(salida.includes(">"), false);
    assert.equal(salida.includes("&"), false);
    assert.equal(salida.includes("\u2028"), false);
    assert.ok(salida.includes("\\u003e"));
    assert.ok(salida.includes("\\u0026"));
  });

  it("sigue siendo JSON válido y con el mismo contenido (Google lo parsea)", () => {
    const original = {
      "@context": "https://schema.org",
      name: "Pensión Ñandú & Cía </script>",
      price: 600000,
      anidado: { lista: ["uno", "dos"], nulo: null },
    };
    assert.deepEqual(JSON.parse(serializarJsonLd(original)), original);
  });

  it("no altera un texto normal (no rompe el SEO por escapar de más)", () => {
    const normal = { name: "Residencia Makia", barrio: "Mamatoco" };
    assert.equal(serializarJsonLd(normal), JSON.stringify(normal));
  });
});

describe("hostImagenPermitido · lista blanca del optimizador de imágenes", () => {
  it("admite los dos orígenes declarados", () => {
    assert.equal(hostImagenPermitido("https://images.unsplash.com/photo-1.jpg"), true);
    assert.equal(hostImagenPermitido("https://images.unsplash.com"), true);
    assert.equal(hostImagenPermitido("https://supabase.co/foto.jpg"), true);
    assert.equal(
      hostImagenPermitido("https://ayznnqkacpdvvufclhon.supabase.co/storage/v1/object/public/fotos-pensiones/u/1.jpg"),
      true
    );
  });

  it("rechaza cualquier otro origen (un proxy abierto es un vector de abuso)", () => {
    assert.equal(hostImagenPermitido("https://evil.com/foto.jpg"), false);
    assert.equal(hostImagenPermitido("https://encrypted-tbn0.gstatic.com/images?q=tbn"), false);
    assert.equal(hostImagenPermitido("https://otro-supabase.co.evil.com/foto.jpg"), false);
    assert.equal(hostImagenPermitido("https://ayznnqkacpdvvufclhon.supabase.co.evil.com/f.jpg"), false);
  });

  it("no se deja engañar por un subdominio que solo lo parece", () => {
    assert.equal(hostImagenPermitido("https://evil-images.unsplash.com/f.jpg"), false);
    assert.equal(hostImagenPermitido("https://images.unsplash.com.evil.com/f.jpg"), false);
  });

  it("exige https", () => {
    assert.equal(hostImagenPermitido("http://images.unsplash.com/f.jpg"), false);
    assert.equal(hostImagenPermitido("ftp://images.unsplash.com/f.jpg"), false);
  });

  it("rechaza esquemas peligrosos y entradas vacías sin lanzar", () => {
    assert.equal(hostImagenPermitido("javascript:alert(1)"), false);
    assert.equal(hostImagenPermitido("data:image/svg+xml;base64,PHN2Zz4="), false);
    assert.equal(hostImagenPermitido(""), false);
    assert.equal(hostImagenPermitido("no es una url"), false);
  });
});
