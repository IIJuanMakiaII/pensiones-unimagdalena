/**
 * El buscador del panel maestro (tarea #88).
 *
 * POR QUÉ ESTE MÓDULO ESTÁ SOLO, Y NO DENTRO DEL COMPONENTE
 * --------------------------------------------------------
 * La regla de coincidencia es la pieza que más fácil se rompe sin que nadie lo note:
 * un acento, una mayúscula o un guion cambian el resultado, y el panel no avisa
 * cuando encuentra de menos. Aquí es una función pura —sin React, sin base de
 * datos, sin `next/*`— y por eso `pruebas/` puede ejercitarla con Node, que no
 * importa `.tsx`.
 *
 * DOS REGLAS, Y NINGUNA MÁS
 * ------------------------
 * `1.` **Todos los tokens, como subcadena.** La consulta se parte por espacios y
 * cada token tiene que aparecer dentro del campo. Así `villa caribe` encuentra
 * «Villa del Caribe» (los tokens están, en cualquier orden y con palabras de por
 * medio) y `nid 0001`, `NID-0001` y `nid0001` encuentran lo mismo, porque el campo
 * se reduce a letras y dígitos antes de comparar.
 *
 * `2.` **El código, ignorando los ceros a la izquierda.** Es la regla que hace el
 * identificador **dictable por teléfono**: quien llama dice «nido uno» y quien
 * busca teclea `NID-1` o `nid 1`, no `NID-0001`. Sin ella, el formato de cuatro
 * dígitos obligaría a recordar cuántos ceros lleva, que es exactamente el trabajo
 * que un identificador debería ahorrar.
 *
 * `3.` **Cuando la consulta es un código y ese código existe, el código decide.**
 * Esta tercera no estaba en el encargo y nació de medir la segunda: `nid 1` se
 * parte en dos tokens (`nid`, `1`) y, aplicando solo la regla 1, cualquier anuncio
 * cuyo código contenga un `1` —o sea, casi todos— coincidía. En un catálogo de cien
 * anuncios la forma dictada por teléfono devolvía media lista, que es justo lo que
 * hace inservible un buscador. Ahora, si la consulta se reduce a `nid<número>` y hay
 * un anuncio con ese número, la respuesta es ese anuncio. Si no hay ninguno —el caso
 * de un parcial como `nid00`, cuyo número es 0 y no identifica a nadie—, se cae a la
 * regla 1 y el parcial sigue funcionando como parcial.
 *
 * QUE LA CONSULTA NO ADIVINE MÁS DE LO QUE DICE
 * --------------------------------------------
 * No se busca dentro del precio: un `600000` devolvería medio catálogo, y una
 * búsqueda que responde «casi todo» se deja de usar. Tampoco se mira el `id`
 * interno (un UUID que nadie dicta) ni `anfitrion_id`.
 *
 * Y no se reordena ni se redirige nada: esto **filtra**. Un código mal tecleado
 * tiene que dar una lista vacía con su mensaje, no llevar a ninguna parte.
 */

/** Un anuncio, en lo único que este módulo necesita mirar. */
export interface PensionBuscable {
  /** `null` mientras la base no haya repartido códigos (la columna es opcional). */
  codigo_visible?: string | null;
  titulo: string;
  slug: string;
  barrio: string;
}

/** Tope de la consulta. Un buscador no es un campo de texto largo. */
export const MAXIMO_DE_CONSULTA = 60;

/**
 * Reduce un texto a letras y dígitos, en minúsculas y sin acentos.
 *
 * Se quitan los diacríticos **descomponiendo** (`NFD`) y descartando las marcas,
 * que es lo que hace que `Cabaña` y `cabana` sean la misma cadena. No se usa una
 * lista de letras colombianas: `NFD` cubre cualquier acento que llegue de un
 * anuncio, y una lista se quedaría corta en la primera `ü` que nadie previó.
 */
export function normalizarDimension(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** La consulta, ya recortada y limitada, tal como se compara. */
export function prepararConsulta(consulta: string): string {
  return consulta.trim().slice(0, MAXIMO_DE_CONSULTA);
}

/** El número de un código escrito como `NID-0001` → `1`. `null` si no es un código. */
function numeroDeCodigo(codigo: string): number | null {
  const coincidencia = /^nid(\d+)$/.exec(normalizarDimension(codigo));
  if (!coincidencia) return null;
  const numero = Number(coincidencia[1]);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * ¿Este anuncio coincide con la consulta?
 *
 * `consulta` llega **ya preparada** por `prepararConsulta`; se pide así porque esta
 * función se llama una vez por anuncio y no debe repetir el recorte y la
 * normalización de la consulta en cada vuelta.
 */
export function coincideConConsulta(
  pension: PensionBuscable,
  consulta: string,
  consultaNormalizada: string
): boolean {
  if (consulta === "") return true;

  const tokens = consulta
    .split(/\s+/)
    .map(normalizarDimension)
    .filter((token) => token !== "");

  const campos = [
    normalizarDimension(pension.codigo_visible ?? ""),
    normalizarDimension(pension.titulo),
    normalizarDimension(pension.slug),
    normalizarDimension(pension.barrio),
  ];

  // Regla 1: todos los tokens, cada uno dentro de algún campo.
  if (tokens.length > 0 && tokens.every((token) => campos.some((campo) => campo.includes(token)))) {
    return true;
  }

  // Regla 2: el código, ignorando los ceros a la izquierda.
  const pedido = numeroDeCodigo(consultaNormalizada);
  if (pedido !== null) {
    const propio = numeroDeCodigo(pension.codigo_visible ?? "");
    if (propio !== null && propio === pedido) return true;
  }

  return false;
}

/**
 * La lista filtrada, **en el mismo orden en que llegó**.
 *
 * Sin consulta se devuelve la misma lista, sin recorrerla: filtrar por nada no
 * puede cambiar el panel ni el recuento.
 */
export function filtrarPensiones<T extends PensionBuscable>(pensiones: T[], consulta: string): T[] {
  const limpia = prepararConsulta(consulta);
  if (limpia === "") return pensiones;

  const consultaNormalizada = normalizarDimension(limpia);

  /*
   * Regla 3: si lo que se tecleó **es** un código que existe, la respuesta es ese
   * anuncio y no «todos los que contienen un 1». La comprobación se hace una sola
   * vez, no por anuncio, y solo decide cuando encuentra algo: si el número no
   * identifica a nadie, la lista sigue su curso por la regla 1.
   */
  const pedido = numeroDeCodigo(consultaNormalizada);
  if (pedido !== null) {
    const porCodigo = pensiones.filter(
      (pension) => numeroDeCodigo(pension.codigo_visible ?? "") === pedido
    );
    if (porCodigo.length > 0) return porCodigo;
  }

  return pensiones.filter((pension) => coincideConConsulta(pension, limpia, consultaNormalizada));
}
