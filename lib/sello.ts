/**
 * El sello «Verificado por Nido ✓» (tarea #51).
 *
 * Vive aquí, fuera del componente, por dos razones concretas:
 *
 *   1. El texto del sello es una decisión de producto, no de maquetación: la
 *      tarjeta y la ficha de una pensión tienen que decir exactamente lo mismo.
 *      Con una sola constante no hay forma de que una diga una cosa y la otra
 *      otra distinta.
 *   2. Una insignia de confianza tiene que poder probarse **sin dibujar nada**,
 *      y el ejecutor de pruebas del proyecto no puede importar un `.tsx` (Node
 *      no entiende JSX). Si esta decisión viviera dentro del componente, el caso
 *      negativo —un anuncio sin verificar no muestra nada— quedaría sin
 *      comprobar, que es justo la mitad que importa.
 */

/** Texto visible del sello. Es también su nombre accesible: no lleva `aria-label` aparte. */
export const TEXTO_SELLO = "Verificado por Nido ✓";

/**
 * ¿Se muestra el sello?
 *
 * Compara contra el booleano `true`, no contra la veracidad del valor. El sello
 * lo concede únicamente el maestro, y `verificado` llega de la base a través de
 * `lib/supabase/mapeo.ts`. Si algún día ese mapeo devolviera `"false"`, `1` o un
 * objeto, esta comparación sigue sin pintar la insignia: **falla cerrado**, que
 * es lo único aceptable en una señal de confianza. Una insignia que se cuela
 * sola es peor que no tener insignia.
 */
export function mostrarSello(verificado: unknown): boolean {
  return verificado === true;
}
