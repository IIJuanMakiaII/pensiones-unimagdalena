/**
 * Serialización segura de datos estructurados (JSON-LD).
 *
 * `JSON.stringify` NO escapa `<`, así que un texto publicado por un anfitrión
 * como `</script><script>alert(1)</script>` cerraría la etiqueta y ejecutaría
 * código en el dominio de la marca (XSS almacenado). Esta función escapa los
 * caracteres peligrosos en su forma Unicode, que sigue siendo JSON válido.
 *
 * Acepta además U+2028 y U+2029, que rompen el parseo en algunos motores.
 */
export function serializarJsonLd(datos: unknown): string {
  return JSON.stringify(datos)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
