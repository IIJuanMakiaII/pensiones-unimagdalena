"use client";

import type { ReactNode } from "react";
import type { ContactoDePanel } from "@/lib/contacto-panel";
import { WhatsAppIcon } from "@/components/CardPension";

/**
 * El WhatsApp privado del anfitrión, visto por el equipo de Nido (tareas #77 y #79).
 *
 * POR QUÉ EXISTE ESTE COMPONENTE, Y POR QUÉ ES UNO SOLO
 * ----------------------------------------------------
 * La misma tarjeta hace falta en dos sitios: la lista del panel maestro
 * (`components/PanelMaestro.tsx`) y el formulario de edición del maestro
 * (`app/maestro/[id]/editar`). Estuvo solo en el panel, y eso produjo un hueco
 * real: el maestro abría «Editar anuncio» desde su panel, no veía ningún campo de
 * WhatsApp y no tenía forma de saber por qué. La conclusión natural era que el
 * dato no existía, que es lo contrario de lo cierto.
 *
 * Se escribe una vez y se usa en los dos sitios porque la frase de privacidad
 * —«solo lo ve el equipo de Nido…»— no puede divergir entre dos pantallas que
 * hablan del mismo dato. Dos copias del mismo texto es exactamente cómo una
 * acaba diciendo algo que ya no es verdad.
 *
 * NO TIENE CAMPO DE ESCRITURA, Y ESO ES LA DECISIÓN, NO UN OLVIDO
 * --------------------------------------------------------------
 * Aquí **no hay ningún `<input>`**, y no es una simplificación: es la
 * característica. El número pertenece a la persona, no al anuncio, y el maestro
 * no debe poder pisarlo. Si esto pintara un campo, el maestro lo vería **vacío**
 * —él no tiene número que mostrar— y al guardar cualquier corrección del anuncio
 * lo sobrescribiría con nada, sin que nadie se enterara. Por eso el formulario de
 * `/maestro/[id]/editar` sigue sin mandar este dato al servidor: lo que se ve, se
 * ve; lo que se escribe, no viaja.
 *
 * LAS CUATRO RESPUESTAS, Y POR QUÉ NO SE PUEDEN FUNDIR EN UNA
 * ----------------------------------------------------------
 *  · `ok`         → el número, y el botón para escribirle.
 *  · `sin-numero` → no lo ha dejado. No es un error y se dice como lo que es.
 *  · `sin-tabla`  → la migración no está aplicada. **No se pinta nada**: no hay
 *                   nada que contar y el maestro no tiene que enterarse de un
 *                   detalle interno. Era el comportamiento del panel y se respeta.
 *  · `error`      → no se pudo comprobar. **Aquí sí hay que decir que no se pudo**,
 *                   nunca «este anfitrión no tiene número»: confundir los dos hace
 *                   que el maestro concluya lo contrario de lo cierto, y es el
 *                   motivo por el que el lector devuelve el motivo junto al mapa.
 *
 * El enlace `wa.me` llega ya construido desde el servidor (`ContactoDePanel`), así
 * que **aquí no se arma ninguna URL a mano**: un enlace mal formado es peor que
 * ninguno, porque el maestro creería haber escrito.
 */
export default function ContactoAnfitrionPrivado({
  contacto,
  titulo,
  className = "mt-4",
  accion,
}: {
  contacto: ContactoDePanel;
  /** Título del anuncio. Solo se usa para el nombre accesible del enlace. */
  titulo: string;
  /**
   * Margen y posición, que es lo único que cambia entre las dos pantallas.
   *
   * El panel maestro apila sus bloques con `mt-4` explícito —su contenedor no tiene
   * `space-y`—, así que ese es el valor por defecto y su aspecto no cambia. El
   * formulario sí vive dentro de un `space-y-5`, y ahí un `mt-4` de más sumaría
   * 36 px de hueco en vez de 20: esa pantalla pasa `mt-0` y deja que el `space-y`
   * haga su trabajo.
   */
  className?: string;
  /**
   * Lo que cada pantalla quiera colgar de la tarjeta, al final. Opcional.
   *
   * Es un nodo y no una bandera a propósito: si esta tarjeta supiera **qué**
   * montar, tendría campos, y su valor entero está en no tenerlos. Así el panel
   * le pasa el bloque de corrección y la pantalla de edición no le pasa nada,
   * sin que la tarjeta tenga que decidir quién puede qué.
   */
  accion?: ReactNode;
}) {
  if (contacto.estado === "sin-tabla") return null;

  if (contacto.estado === "sin-numero") {
    return (
      <p className={`${className} text-xs leading-relaxed text-neutro-500`}>
        Este anfitrión todavía no ha registrado su WhatsApp. Puede dejarlo al publicar o al editar
        su anuncio; en cuanto lo haga, el botón para escribirle aparece aquí.
      </p>
    );
  }

  if (contacto.estado === "error") {
    return (
      <p
        className={`${className} rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-3 py-2 text-xs leading-relaxed text-neutro-700`}
      >
        <strong>No pudimos comprobar</strong> el WhatsApp de este anfitrión. Eso no significa que no
        lo tenga: vuelve a cargar la página en unos segundos.
      </p>
    );
  }

  return (
    <div className={`${className} rounded-xl border border-neutro-200 bg-neutro-50 p-4`}>
      <p className="text-sm font-bold text-neutro-800">WhatsApp privado del anfitrión</p>
      <p className="mt-0.5 text-base font-semibold tracking-wide text-neutro-900">
        {contacto.whatsapp}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-neutro-500">
        Solo lo ve el equipo de Nido: no aparece en el anuncio, ni en la ficha, ni en el mensaje que
        recibe el estudiante. El número lo registra el anfitrión desde su propia cuenta, y el equipo
        de Nido puede corregirlo si él avisa de un cambio.
      </p>

      <a
        href={contacto.enlace}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Escribir por WhatsApp al anfitrión de «${titulo}»`}
        className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700"
      >
        <WhatsAppIcon className="h-5 w-5" />
        Escribir al anfitrión
      </a>

      {/*
        Aquí van las acciones que cada pantalla quiera colgar de la tarjeta. Hoy el
        panel del maestro le pasa el bloque para corregir el número (tarea #80), y
        la pantalla de edición no le pasa nada.

        Se recibe hecho, como un nodo, y no como una bandera del tipo «se puede
        editar»: si esta tarjeta tuviera que saber qué campos montar, dejaría de
        ser la que **no tiene campos** —y hay una prueba que lo vigila—, que es
        justo lo que la hace segura dentro del `<form>` de la pantalla de edición.
      */}
      {accion}
    </div>
  );
}
