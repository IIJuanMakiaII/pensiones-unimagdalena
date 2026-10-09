/**
 * La confirmación de un borrado (tarea #34).
 *
 * Vivía en `lib/maestro.ts`, y se movió aquí al escribir el panel: aquel módulo
 * importa el cliente de servidor de Supabase —que usa `cookies()`—, así que
 * cualquier componente de cliente que quisiera mostrar la palabra la arrastraría
 * entera al navegador y el build fallaría. Este archivo no importa nada.
 *
 * La consecuencia útil es que la palabra es **una sola** para las dos orillas: el
 * panel la enseña y el servidor la exige, y no pueden separarse.
 */

/**
 * Palabra que hay que escribir para confirmar un borrado.
 *
 * La pantalla previa —la que nombra el anuncio y explica qué se pierde— se apoya
 * en el cliente, y por eso no basta: cualquiera puede enviar el formulario sin
 * pasar por ella. Esta palabra es la parte que el servidor sí puede exigir.
 *
 * Es deliberadamente una palabra y no la dirección del anuncio: no se copia y
 * pega por accidente ni se confunde con un enlace.
 */
export const PALABRA_DE_BORRADO = "BORRAR";

/** ¿La confirmación escrita autoriza el borrado? Compara sin distinguir mayúsculas ni espacios sobrantes. */
export function confirmacionDeBorradoValida(valor: string): boolean {
  return valor.trim().toUpperCase() === PALABRA_DE_BORRADO;
}
