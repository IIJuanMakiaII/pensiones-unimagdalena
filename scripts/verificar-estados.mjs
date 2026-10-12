// Códigos de estado de la ruta de detalle, incluidos los casos que no existen,
// y el estado de la portada cuando no hay ninguna ficha publicada.
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
//
// ESTADO SIN FICHA (tarea #69)
// ----------------------------
// Sin ninguna ficha enlazada, la portada tiene tres estados posibles y este guion
// tiene que poder decir en cuál está, en vez de emitir un `OMITIDO` que dejaba sin
// comprobar justo el caso que importa cuando el inventario se vacía:
//
//   «sin-inventario»  La portada muestra la lista de espera (tarea #57). Es la
//                     respuesta correcta: hay una salida de contacto y una vuelta
//                     para el propietario, y no una parrilla vacía.
//   «demostracion»    La demostración está encendida, así que el catálogo se dibuja
//                     con los anuncios de ejemplo. El estado sin inventario es
//                     estructuralmente inalcanzable aquí —`mostrarListaDeEspera()`
//                     devuelve falso con la demostración activa—, así que no se
//                     puede exigir. Se declara como `NOTA`, nunca como superado.
//   «desconocido»     Ni una cosa ni la otra: la portada dibuja la parrilla vacía
//                     del catálogo, que es el defecto que la tarea #57 corrigió y
//                     que reaparece por configuración cuando la demostración queda
//                     encendida con cero anuncios reales. Es un FALLO.
//
// `ESTADO_ESPERADO` (opcional) convierte la detección en una exigencia:
//
//   $env:ESTADO_ESPERADO='sin-inventario'   node scripts/verificar-estados.mjs
//
// Es la forma de comprobar el ciclo de ocultar y reactivar la demostración, y la
// que hay que usar contra un despliegue donde la demostración está apagada: ahí el
// estado sin inventario no solo es alcanzable, es obligatorio.
//
// IDENTIDAD DEL SERVIDOR
// ----------------------
// Antes de medir nada, el guion comprueba que quien contesta en `BASE` sea Nido. El
// puerto 3000 puede estar ocupado por otra aplicación —ocurrió en esta máquina—, y
// sin esta guardia el guion mediría un sitio ajeno y emitiría un veredicto sobre
// él. Si las señales no coinciden, aborta sin medir.
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

/**
 * Cabeceras de la petición. La clave de omisión de Deployment Protection entra por
 * `VERCEL_PROTECTION_BYPASS` **solo desde el entorno del proceso**: hace falta para
 * medir dentro de un Preview protegido, y el valor no se imprime nunca ni se escribe
 * en ningún archivo del repositorio. Sin ella, todo sigue funcionando como antes.
 */
const CABECERAS = {
  "cache-control": "no-cache",
  ...(process.env.VERCEL_PROTECTION_BYPASS
    ? { "x-vercel-protection-bypass": process.env.VERCEL_PROTECTION_BYPASS }
    : {}),
};

/** Estados que este guion sabe reconocer. Cualquier otra cosa es un fallo. */
const ESTADOS = ["con-ficha", "sin-inventario", "demostracion", "desconocido"];

/** `auto` = detectar y exigir solo lo que se pueda demostrar. */
const ESPERADO = (process.env.ESTADO_ESPERADO ?? "auto").trim().toLowerCase();

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
 * Quien mide si la base y la superficie pública coinciden —y con qué política—
 * es `verificar-retirada.mjs`; este archivo mide códigos de estado y el estado de
 * la portada, así que su control tiene que salir del propio sitio.
 */
const inicio = await (await fetch(BASE + "/", { headers: CABECERAS })).text();

/**
 * Guardia de identidad: ¿quien contesta en `BASE` es Nido de verdad?
 *
 * Esto no es paranoia, es un caso real y ya ocurrió en esta máquina. El puerto
 * 3000 **no** es de este espacio de trabajo: hay otro espacio con un `next dev`
 * ocupándolo, así que un guion que solo se detenga ante `ECONNREFUSED` recibirá
 * respuestas y emitirá un veredicto sobre una aplicación que no es la nuestra.
 * Se comprobó: la mitad «nadie contesta» estaba cubierta; la mitad «contesta otro»
 * no la cubría nada.
 *
 * Dos señales independientes y de la propia identidad del sitio, no del estado que
 * se quiere medir: el título con la marca y el nombre de la universidad, que viaja
 * en el pie y en la cabecera de todas las páginas. Si el sitio cambiara de marca,
 * hay que actualizar esto — y el propio mensaje de aborto lo dice.
 */
const SENALES_SITIO = [
  { nombre: "el título lleva la marca «Nido»", coincide: /<title>[^<]*\bNido\b[^<]*<\/title>/i.test(inicio) },
  {
    nombre: "la página nombra «Universidad del Magdalena»",
    coincide: inicio.includes("Universidad del Magdalena"),
  },
];

const senalesQueFaltan = SENALES_SITIO.filter((senal) => !senal.coincide);

if (senalesQueFaltan.length > 0) {
  console.log(
    `ABORTA: lo que responde en ${BASE} no parece ser Nido, así que no se emite veredicto.\n` +
      senalesQueFaltan.map((senal) => `         falta: ${senal.nombre}.`).join("\n") +
      `\n         Comprueba dónde apunta BASE_URL: el puerto 3000 puede estar ocupado por\n` +
      `         otra aplicación. Si el sitio cambió de marca, actualiza SENALES_SITIO en\n` +
      `         este archivo antes de medir.`
  );
  process.exit(1);
}

const enlazada = inicio.match(/href="(\/pensiones\/[^"#?]+)"/);

const casos = [
  ["uuid inexistente", "/pensiones/00000000-0000-4000-8000-000000000000", 404],
  ["ruta inexistente", "/ruta-inexistente", 404],
];

if (enlazada) {
  casos.push(["ficha enlazada por el sitio (control)", enlazada[1], 200]);
}

let fallos = 0;

for (const [nombre, ruta, esperado] of casos) {
  const respuesta = await fetch(BASE + ruta, { headers: CABECERAS });
  await respuesta.text();

  const ok = respuesta.status === esperado;
  if (!ok) fallos += 1;

  console.log(
    `${ok ? "OK  " : "FALLO"} HTTP ${String(respuesta.status).padEnd(4)} (esperado ${esperado})  ${nombre.padEnd(26)} ${ruta}`
  );
}

/**
 * El estado de la portada sin ninguna ficha enlazada.
 *
 * Los dos marcadores son deliberadamente estructurales y no de texto:
 *   - La lista de espera se reconoce por `id="lista-espera-titulo"`, el ancla de su
 *     `aria-labelledby`. Su TÍTULO no sirve: el mismo texto («Todavía no hay
 *     pensiones publicadas») lo escribe el bloque de catálogo vacío de
 *     `CatalogoInteractivo.tsx`, así que una comprobación por texto daría la lista
 *     de espera por buena en el estado roto.
 *   - La demostración se reconoce por el aviso que el pie imprime solo cuando
 *     `DEMO_HABILITADA` es cierto. Eso distingue «la portada dibuja los anuncios
 *     de ejemplo» de «la portada está rota», que es la duda real.
 */
const esperaPresente = /id="lista-espera-titulo"/.test(inicio);
const demoMarcada = /Datos de demostraci/.test(inicio);

const estado = !enlazada
  ? esperaPresente
    ? "sin-inventario"
    : demoMarcada
      ? "demostracion"
      : "desconocido"
  : "con-ficha";

if (ESPERADO !== "auto" && !ESTADOS.includes(ESPERADO)) {
  fallos += 1;
  console.log(
    `FALLO  ESTADO_ESPERADO='${ESPERADO}' no es un estado conocido.\n` +
      `         Valores válidos: auto, ${ESTADOS.join(", ")}.`
  );
} else if (!enlazada) {
  const exigido = ESPERADO === "auto" ? null : ESPERADO;

  if (exigido !== null && exigido !== estado) {
    fallos += 1;
    console.log(
      `FALLO  Estado de la portada                    la portada está en «${estado}», se exigía «${exigido}»`
    );
  } else if (estado === "sin-inventario") {
    console.log(
      "OK     Estado sin inventario comprobado       lista de espera con salida de contacto y vuelta del propietario"
    );
  } else if (estado === "demostracion") {
    console.log(
      "NOTA   La demostración está encendida, así que el estado sin inventario no es\n" +
        "         alcanzable en esta instancia y no se puede exigir. Esto NO cuenta como\n" +
        "         superado: ni se comprueba ni se omite en silencio.\n" +
        "         Para exigirlo, apaga la demostración y repite con\n" +
        "         $env:ESTADO_ESPERADO='sin-inventario'."
    );
  } else {
    fallos += 1;
    console.log(
      "FALLO  Estado de la portada                    la portada no enlaza ninguna ficha y\n" +
        "         tampoco declara un estado conocido: ni lista de espera (id=\"lista-espera-titulo\")\n" +
        "         ni demostración (aviso del pie). Es la parrilla vacía del catálogo, que es\n" +
        "         justo lo que la lista de espera vino a sustituir."
    );
  }
}

/**
 * Qué se comprobó, dicho sin adornos. `auto` deja fuera de la cuenta el control de
 * ficha real solo cuando no hay ninguna publicada, y el estado de la portada
 * cuando la demostración lo hace inalcanzable; ninguna de las dos cosas se declara
 * superada.
 */
const comprobado = [
  `${casos.length} caso(s) de código de estado`,
  enlazada ? "el control de ficha real" : "sin control de ficha real (no hay ninguna publicada)",
  ESPERADO === "auto" ? `estado de la portada: ${estado}` : `estado de la portada exigido: ${ESPERADO}`,
];

console.log(
  fallos === 0
    ? `\nTodo lo comprobado es lo esperado: ${comprobado.join("; ")}.`
    : `\n${fallos} caso(s) con un resultado inesperado.`
);

process.exit(fallos === 0 ? 0 : 1);
