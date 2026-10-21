/**
 * La frontera entre lo que el servidor sabe y lo que el navegador necesita
 * (tarea #93).
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 * -------------------------
 * En Next, los props que un componente de cliente recibe se serializan **dentro
 * del HTML**, en el payload RSC (`<script>self.__next_f.push(...)</script>`). No se
 * dibujan, así que ninguna revisión del texto visible los encuentra; y sin embargo
 * viajan al navegador de cualquiera que abra la página.
 *
 * Hasta esta tarea, la portada le entregaba al catálogo la lista completa de
 * anuncios y la ficha le entregaba al detalle el anuncio completo. Con eso cruzaban
 * dos datos que la interfaz pública no usa:
 *
 *   - **`codigo_visible`** (`NID-0001`), el identificador de administración. Su
 *     lectura con la clave anónima se concedió a conciencia en la oleada 16, así
 *     que esto no lo hace más secreto; lo que se corrige es que **no viaje** a una
 *     pantalla que no lo muestra.
 *   - **`anfitrion_id`**, el identificador interno de la cuenta que publicó. Este
 *     nunca se decidió publicar: es el que de verdad importaba sacar de ahí.
 *
 * POR QUÉ SE RECORTA AQUÍ Y NO EN LA CONSULTA
 * -------------------------------------------
 * La tentación es pedir menos columnas en las rutas públicas. No se hace: la
 * proyección (`COLUMNAS_PENSION`) es **una sola y compartida** por el catálogo, la
 * ficha y el panel, y el `select` de `pensiones` está concedido **columna por
 * columna**. Separar proyecciones significa dos listas de columnas que pueden
 * desincronizarse del `grant`, y eso ya se cobró una tarde en este proyecto: la
 * consulta no devuelve menos, **falla con `42501`** y el catálogo entero se cae.
 *
 * Así que la consulta y los privilegios se quedan como están, y el recorte ocurre
 * en el único punto donde el dato iba a cruzar al cliente. El panel maestro **no**
 * pasa por aquí: sigue recibiendo el objeto entero, porque necesita el código para
 * mostrarlo y buscar, y el `anfitrion_id` para resolver el contacto.
 *
 * QUÉ SE RECORTA Y QUÉ NO
 * -----------------------
 * Solo esos dos campos. No se aprovecha para recortar más: cada campo que se quite
 * de aquí es un campo que un componente de cliente no podrá usar mañana sin que
 * nadie entienda por qué falta, y este módulo no es un catálogo de lo que el
 * servidor sabe, sino la lista —corta y justificada— de lo que el navegador **no**
 * debe recibir.
 */
import type { PensionConHabitaciones, PensionPublica } from "@/types";

/**
 * El tipo vive en `types/index.ts` y se reexporta desde aquí, junto al código que lo
 * respeta, para que quien recorte no tenga que buscarlo en otro sitio. Se declara en
 * `types` porque también lo necesitan los helpers de `lib/pension.ts`, `lib/filtros.ts`
 * y `lib/formato.ts`, que reciben estos objetos y no deberían depender de este módulo.
 */
export type { PensionPublica };

/**
 * El anuncio, sin los dos campos internos.
 *
 * Devuelve una copia: el objeto que llega no se muta, porque quien lo pasa sigue
 * usándolo en el servidor —la ficha arma con él sus datos estructurados y sus
 * migas— y mutarlo le quitaría campos por debajo.
 */
export function paraVistaPublica(pension: PensionConHabitaciones): PensionPublica {
  const { anfitrion_id: _anfitrion, codigo_visible: _codigo, ...resto } = pension;
  return resto;
}

/** La lista, recortada anuncio por anuncio. */
export function paraVistaPublicaLista(
  pensiones: PensionConHabitaciones[]
): PensionPublica[] {
  return pensiones.map(paraVistaPublica);
}
