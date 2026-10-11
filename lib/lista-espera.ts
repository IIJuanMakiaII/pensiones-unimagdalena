/**
 * Estado de lista de espera del catálogo (tarea #57).
 *
 * Con el catálogo vacío, la portada dibujaba la parrilla del catálogo sin nada
 * dentro: un bloque que le pedía al **propietario** que publicara. Quien llega a
 * la portada es, sobre todo, un estudiante buscando habitación, así que el
 * resultado era una portada sin inventario **y sin forma de dejar un contacto**.
 *
 * La decisión vive aquí, fuera del componente, por la misma razón que
 * `lib/sello.ts`: el ejecutor de pruebas del proyecto no puede importar un `.tsx`
 * (Node no entiende JSX), y la mitad que importa es justo la que no se ve. Dentro
 * del JSX, «nunca se dibuja una parrilla vacía» quedaría sin comprobar.
 */

/**
 * ¿La portada tiene que mostrar el estado de lista de espera?
 *
 * Se escribe `!(cantidad > 0)` y no `cantidad === 0` a propósito. Si el conteo
 * llegara como `NaN` —una respuesta con una forma que no se esperaba—, `=== 0`
 * sería falso y la portada volvería a dibujar una parrilla sin nada dentro, que es
 * exactamente el fallo que esto evita. Así, cualquier cantidad que **no se pueda
 * demostrar** mayor que cero cae del lado de la lista de espera.
 *
 * La demostración se respeta: con `NEXT_PUBLIC_MOSTRAR_DEMO` activa (y siempre en
 * desarrollo) el catálogo sigue dibujándose, porque ahí sí hay contenido que
 * mostrar —seis anuncios de ejemplo— y el propio catálogo ofrece el botón para
 * volver al real. Sin esta condición, activar la demostración dejaría la portada
 * sin la demostración.
 */
export function mostrarListaDeEspera(
  cantidadInventario: number,
  demoHabilitada: boolean
): boolean {
  return !(cantidadInventario > 0) && !demoHabilitada;
}

/**
 * El texto que ya va redactado en el WhatsApp, para que quien llega no tenga que
 * explicar por qué escribe.
 *
 * Sigue el tono de las plantillas de `lib/formato.ts` (saludo y sin tecnicismos) y
 * **no promete nada que la plataforma no pueda cumplir**: no dice que haya
 * pensiones verificadas —no las hay todavía, es justo el motivo de este estado— ni
 * lleva enlaces ni datos personales, porque este texto viaja dentro de una URL.
 */
export const MENSAJE_LISTA_ESPERA =
  "Hola 👋, quiero que me avisen cuando haya habitaciones disponibles cerca de la Universidad del Magdalena.";
