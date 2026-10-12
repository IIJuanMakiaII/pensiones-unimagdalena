import type { ContactoLeido, MotivoSinContacto } from "@/lib/contacto-anfitrion";
import { enlaceParaEscribirAlAnfitrion } from "@/lib/contacto-anfitrion";

/**
 * El WhatsApp privado, ya resuelto para el panel del maestro (tarea #77).
 *
 * POR QUÉ HAY UN MÓDULO ENTERO PARA ESTO
 * --------------------------------------
 * Dos razones, y las dos son de seguridad de tipos y de empaquetado:
 *
 *  1. **El enlace se construye en el servidor.** `enlaceParaEscribirAlAnfitrion()`
 *     vive en `lib/contacto-anfitrion.ts`, que importa `@/utils/supabase/server`
 *     (`next/headers`). Un componente de cliente **no puede** importar ese módulo:
 *     arrastraría código de servidor al navegador y la compilación lo rechaza. Así
 *     que el enlace se arma aquí, en el componente de servidor del panel, y a la
 *     tarjeta le llega ya hecho. De paso se cumple la regla de la #76: **la URL no
 *     se construye a mano en ninguna parte**, porque un enlace mal armado es peor
 *     que ninguno —el maestro creería haber escrito—.
 *
 *  2. **Los cuatro estados viajan con nombre propio.** El lector devuelve un mapa
 *     de números y un motivo (`sin-tabla` | `error` | `null`), y la tarjeta
 *     necesita distinguir «no hay número», «no sé si hay» y «esto todavía no está
 *     disponible». Confundirlos ya costó una ronda en este proyecto: el maestro
 *     concluiría lo contrario de lo cierto.
 *
 * LA TARJETA IMPORTA EL TIPO CON `import type`
 * --------------------------------------------
 * `components/PanelMaestro.tsx` es de cliente y declara `import type { ContactoDePanel }`.
 * Un `import type` se borra al compilar, así que no arrastra este módulo —ni su
 * dependencia de `next/headers`— al navegador. Es la misma frontera que ya usa
 * `EstadoFormulario` entre las acciones y los formularios.
 */
export type ContactoDePanel =
  | { estado: "ok"; whatsapp: string; enlace: string }
  | { estado: "sin-numero" }
  | { estado: "sin-tabla" }
  | { estado: "error" };

/**
 * Lo que el maestro escribe al anfitrión.
 *
 * Va prellenado y en tercera persona del equipo —no de una persona concreta— por un
 * motivo práctico: quien recibe el mensaje no tiene por qué saber quién lo escribió,
 * y un mensaje vacío obliga al maestro a redactar cada vez. No menciona el número
 * del anfitrión ni ningún dato: es el primer contacto, y lo que se hable después ya
 * es entre ellos.
 */
export const MENSAJE_AL_ANFITRION =
  "Hola, te escribe el equipo de Nido por tu anuncio publicado en el catálogo de habitaciones.";

/**
 * Traduce lo que devolvió la lectura a lo que la tarjeta tiene que pintar.
 *
 * El orden de las comprobaciones es la decisión: **manda el número** si lo hay, y
 * solo cuando no lo hay se mira el motivo. Un mapa vacío por un fallo de red no es
 * lo mismo que un mapa vacío porque nadie ha dejado su número.
 */
export function resolverContactoDePanel(
  whatsapp: string | null,
  motivo: MotivoSinContacto | null
): ContactoDePanel {
  if (whatsapp) {
    const enlace = enlaceParaEscribirAlAnfitrion(whatsapp, MENSAJE_AL_ANFITRION);

    // Un número guardado que no se puede convertir en enlace no es «sin número»:
    // es un fallo, y el maestro tiene que leer que no se pudo, no que el anfitrión
    // no dejó nada. Bajo la restricción de la base no debería poder ocurrir; existe
    // para que el peor caso diga la verdad en lugar de mentir con aplomo.
    return enlace ? { estado: "ok", whatsapp, enlace } : { estado: "error" };
  }

  if (motivo === "sin-tabla") return { estado: "sin-tabla" };
  if (motivo === "error") return { estado: "error" };

  return { estado: "sin-numero" };
}

/**
 * Lo mismo, pero partiendo de la lectura directa (`ContactoLeido`).
 *
 * POR QUÉ EXISTE ESTA FUNCIÓN EN VEZ DE ADAPTAR EN CADA PÁGINA
 * -----------------------------------------------------------
 * El panel del maestro lee **varios** números a la vez y por eso recibe un mapa y un
 * motivo; la página de edición del maestro lee **uno** y recibe la unión de cuatro
 * estados. Son dos formas de llegada distintas y la regla para resolverlas es la
 * misma: manda el número si lo hay y solo después se mira el motivo.
 *
 * Esa regla escrita dos veces es exactamente cómo una de las dos copias acaba
 * diciendo algo que ya no es verdad —el mismo motivo por el que la tarjeta es una
 * sola—, así que la traducción vive aquí, junto al tipo que la define, y las dos
 * pantallas la comparten.
 *
 * Recibe la unión completa y no dos argumentos sueltos para que quien la llame no
 * tenga que desarmar el estado a mano: ese `estado === "ok" ? whatsapp : null`, con
 * su `o` de motivos, es justo el trozo que se copiaría mal.
 */
export function resolverContactoDePanelDesdeLectura(leido: ContactoLeido): ContactoDePanel {
  return resolverContactoDePanel(
    leido.estado === "ok" ? leido.whatsapp : null,
    leido.estado === "sin-tabla" || leido.estado === "error" ? leido.estado : null
  );
}
