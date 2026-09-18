// Comprobación de estructura HTML: contenido interactivo anidado.
//
// Un <a> no puede contener <button> ni otro <a>; un <label> no debería contener
// enlaces ni botones (el label activa su control y el texto del enlace se suma
// al nombre accesible). Es la verificación de las correcciones de UX de la
// Oleada 1.
const base = process.argv[2] ?? "http://127.0.0.1:3000";

// Se incluye una ficha de la semilla (con habitaciones) porque la lista de
// habitaciones solo se dibuja si el anuncio tiene habitaciones: es el único
// camino que ejercita el marcado del botón de reserva y su etiqueta.
const rutas = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["/", "/pensiones/f555e5b3-6629-402a-ae37-32c366c3f022", "/pensiones/pension-costa-verde"];

let fallos = 0;

for (const ruta of rutas) {
  const respuesta = await fetch(base + ruta);
  const html = await respuesta.text();

  if (respuesta.status === 404) {
    console.log(`\n${ruta}\n  omitida: la ficha no existe en este catálogo (404)`);
    continue;
  }

  const anclas = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [];
  const anclasConBoton = anclas.filter((t) => /<button\b/.test(t));
  const anclasConAncla = anclas.filter((t) => (t.match(/<a\b/g) ?? []).length > 1);

  const etiquetas = html.match(/<label\b[^>]*>[\s\S]*?<\/label>/g) ?? [];
  const etiquetasConEnlace = etiquetas.filter((t) => /<a\b|<button\b/.test(t));

  console.log(`\n${ruta}`);
  console.log(`  enlaces revisados: ${anclas.length}`);
  console.log(`  etiquetas revisadas: ${etiquetas.length}`);
  console.log(`  enlaces que contienen un boton: ${anclasConBoton.length} ${anclasConBoton.length === 0 ? "OK" : "FALLO"}`);
  console.log(`  enlaces anidados: ${anclasConAncla.length} ${anclasConAncla.length === 0 ? "OK" : "FALLO"}`);
  console.log(`  etiquetas con enlace o boton dentro: ${etiquetasConEnlace.length} ${etiquetasConEnlace.length === 0 ? "OK" : "FALLO"}`);

  if (anclasConBoton.length || anclasConAncla.length || etiquetasConEnlace.length) {
    fallos += 1;
    for (const muestra of [...anclasConBoton, ...etiquetasConEnlace].slice(0, 2)) {
      console.log("  muestra:", muestra.replace(/\s+/g, " ").slice(0, 220));
    }
  }
}

console.log(fallos === 0 ? "\nEstructura correcta en todas las rutas." : `\n${fallos} ruta(s) con problemas.`);
process.exit(fallos === 0 ? 0 : 1);
