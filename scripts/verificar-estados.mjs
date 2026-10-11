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

/**
 * La ficha de control se toma de lo que el propio sitio enlaza, no de un id
 * escrito a mano.
 *
 * Un id fijo deja de servir como control en cuanto esa publicación se retira:
 * el 404 pasa a ser la respuesta correcta y la comprobación se vuelve un fallo
 * permanente que ya no significa nada. Ya ocurrió dos veces en este archivo —
 * primero con `pension-mamatoco-1` (un identificador que no existía en la
 * semilla) y después con el uuid del anuncio de prueba, que la tarea #58 retira.
 * Aquí figuraban además dos casos atados al estado de la demo
 * (`pension-costa-verde`, que solo responde 200 con la demostración encendida).
 *
 * Quien mide el efecto de una retirada es `verificar-retirada.mjs`; este archivo
 * mide códigos de estado, así que su control tiene que salir del propio sitio.
 */
const inicio = await (
  await fetch(BASE + "/", { headers: { "cache-control": "no-cache" } })
).text();
const enlazada = inicio.match(/href="(\/pensiones\/[^"#?]+)"/);

const casos = [
  ["uuid inexistente", "/pensiones/00000000-0000-4000-8000-000000000000", 404],
  ["ruta inexistente", "/ruta-inexistente", 404],
];

if (enlazada) {
  casos.push(["ficha enlazada por el sitio (control)", enlazada[1], 200]);
} else {
  console.log(
    "OMITIDO  El sitio no enlaza ninguna ficha, así que no hay ficha real que controlar.\n" +
      "         Los casos de 200 no se pueden ejercer: sin anuncios publicados no existe\n" +
      "         la respuesta que se quiere comprobar.\n"
  );
}

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
    ? `\nTodos los códigos de estado son los esperados (${casos.length} caso(s) ejercido(s)` +
      `${enlazada ? "" : ", sin el control de ficha real"}).`
    : `\n${fallos} caso(s) con un código inesperado.`
);

process.exit(fallos === 0 ? 0 : 1);
