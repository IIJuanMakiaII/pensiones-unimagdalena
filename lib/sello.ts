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

/**
 * La fecha de la visita de verificación, ya formateada para el sello (tareas #57 y #61).
 *
 * HOY TODAVÍA NO HAY DATO QUE FORMATEAR, Y ESO ES DELIBERADO
 * ---------------------------------------------------------
 * La fecha no existe como columna ni como campo del contrato de tipos: la añade la
 * tarea #61. Esta función existe para que el día que llegue no haya que decidir nada
 * más, solo pasarla. Hasta entonces devuelve `null` y el sello se dibuja sin fecha,
 * exactamente como antes.
 *
 * POR QUÉ NO SE USA `creada_en`
 * -----------------------------
 * Es la fecha en que se creó el anuncio, no la de la visita. Un sello fechado es una
 * afirmación de verificación —en Colombia, con implicaciones de protección al
 * consumidor—, así que poner ahí una fecha que no es la de la inspección sería la
 * misma promesa sin respaldo que la auditoría señaló.
 *
 * ZONA HORARIA
 * ------------
 * Se formatea en `America/Bogota` a propósito. La columna será `timestamptz`, que se
 * guarda en UTC: una visita de las 20:00 en Santa Marta ya es el día siguiente en UTC,
 * así que formatear con la zona del servidor mostraría un día que no es el de nadie.
 *
 * FALLA CERRADO
 * -------------
 * Solo acepta un `Date` o una cadena ISO no vacía. Cualquier otra cosa —un número, un
 * objeto, una fecha imposible— devuelve `null`, que significa «sin fecha». Una fecha
 * inventada dentro de un sello de confianza es peor que ninguna.
 */
export function formatearFechaVerificacion(valor: unknown): string | null {
  const fecha =
    valor instanceof Date
      ? valor
      : typeof valor === "string" && valor.trim() !== ""
        ? new Date(valor)
        : null;

  if (fecha === null || Number.isNaN(fecha.getTime())) return null;

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(fecha);
}
