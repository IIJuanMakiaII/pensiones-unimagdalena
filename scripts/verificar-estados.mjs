// Códigos de estado de la ruta de detalle, incluidos los casos que no existen.
//
// Historial del hallazgo «soft 404»: /pensiones/<id> respondía 200 aunque la
// publicación no existiera (renderizaba el estado "no encontrada"), mientras que
// una ruta inexistente sí devolvía 404. Corregido en la tarea #15.
//
// Se mide SOLO el código de estado. El texto «no encontrada» NO sirve como
// indicador: viaja en el payload RSC de todas las páginas —también de la home y
// de una ficha real—, así que cualquier comprobación por contenido da positivo
// siempre. Se comprobó y por eso se retiró.
//
// OJO: pedir ids inexistentes hace que Next guarde esa página como HTML en
// `.next/server/app/pensiones/`, y ahí `verificar-seo.mjs` podría leerla como si
// fuera una ficha real (hoy ya lee el manifiesto del build, pero el aviso sigue
// valiendo para otros verificadores). Después de ejecutar esto, borra las fichas
// fantasma con `[System.IO.Directory]::Delete` o recompila: `Remove-Item` no
// completa el borrado en esta máquina.
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const casos = [
  ["uuid inexistente", "/pensiones/00000000-0000-4000-8000-000000000000", 404],
  // La demo sigue encendida, así que el slug de la semilla es contenido válido.
  // Cuando se apague la demo (M-08) pasará a comprobarse contra la base: 404.
  ["slug de la semilla (demo)", "/pensiones/pension-mamatoco-1", 200],
  ["ficha real (control)", "/pensiones/f555e5b3-6629-402a-ae37-32c366c3f022", 200],
  ["ruta inexistente", "/ruta-inexistente", 404],
];

let fallos = 0;

for (const [nombre, ruta, esperado] of casos) {
  const respuesta = await fetch(BASE + ruta, { headers: { "cache-control": "no-cache" } });
  await respuesta.text();

  const ok = respuesta.status === esperado;
  if (!ok) fallos += 1;

  console.log(
    `${ok ? "OK  " : "FALLO"} HTTP ${String(respuesta.status).padEnd(4)} (esperado ${esperado})  ${nombre.padEnd(26)} ${ruta}`
  );
}

console.log(
  fallos === 0
    ? "\nTodos los códigos de estado son los esperados."
    : `\n${fallos} caso(s) con un código inesperado.`
);

process.exit(fallos === 0 ? 0 : 1);
