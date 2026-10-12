"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { corregirWhatsappDelAnfitrion } from "@/app/actions/maestro";
import { CAMPO_WHATSAPP } from "@/lib/formulario-pension";
import type { EstadoFormulario } from "@/lib/pension-escritura";

/**
 * Corregir el WhatsApp del anfitrión cuando él avisa de que cambió (tarea #80).
 *
 * POR QUÉ ESTO NO VIVE DENTRO DE LA TARJETA QUE MUESTRA EL NÚMERO
 * ---------------------------------------------------------------
 * `ContactoAnfitrionPrivado` tiene una característica que no es un detalle: **no
 * contiene ningún campo de formulario**, y una prueba lo vigila. Esa tarjeta la
 * comparten el panel del maestro y la pantalla de edición del maestro, y en la
 * segunda vive dentro de un `<form>`: un campo ahí dentro sería un campo dentro
 * de otro formulario, que no es HTML válido y que al pulsar Intro enviaría lo que
 * no toca.
 *
 * Así que la edición es un bloque aparte, y la tarjeta lo coloca al final sin
 * saber qué es. La garantía de que el número no se puede pisar por accidente
 * sigue viva donde importa: en la acción que guarda el anuncio, que no lee este
 * campo.
 *
 * POR QUÉ HAY UN BOTÓN QUE HAY QUE PULSAR ANTES DE VER EL CAMPO
 * -------------------------------------------------------------
 * Porque el número es de otra persona. Un campo siempre visible y editable
 * invita a tocarlo mientras se hace otra cosa; uno que aparece cuando se pide
 * deja claro que se está entrando a cambiar un dato ajeno. Y como el campo llega
 * **precargado con el número actual** —no vacío—, quien pulse Guardar sin querer
 * cambia algo por lo que escribió a propósito, no por lo que faltaba.
 *
 * EL RÓTULO NO ES EL DEL FORMULARIO DEL ANFITRIÓN, Y ESO ES DELIBERADO
 * -------------------------------------------------------------------
 * Aquel dice «Tu WhatsApp (…)» porque habla con la persona dueña del número. Aquí
 * quien lee es el maestro, y decirle «Tu WhatsApp» sería señalarle el número
 * equivocado: el que se corrige es el de otro. El literal del propietario se
 * respeta donde se dio, y no se traslada a una pantalla que no es la suya.
 */
const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensaje: null };

const claseEtiqueta = "block text-sm font-semibold text-neutro-800";
const claseInput =
  "mt-1 h-11 w-full max-w-[16rem] rounded-xl border border-neutro-300 px-3 text-sm text-neutro-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30";

export default function CorregirWhatsappAnfitrion({
  pensionId,
  whatsappActual,
}: {
  pensionId: string;
  /** El número vigente. Se precarga para que guardar no lo destruya. */
  whatsappActual: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useFormState(corregirWhatsappDelAnfitrion, ESTADO_INICIAL);

  /*
   * Al guardar bien, el campo se cierra solo. Si se quedara abierto, el maestro
   * vería un formulario con el número que acaba de escribir y no sabría si el
   * guardado ocurrió o si aún tiene que pulsar otra cosa. El mensaje se queda
   * fuera del bloque, así que cerrar no se lo lleva por delante.
   */
  useEffect(() => {
    if (estado.ok) setAbierto(false);
  }, [estado]);

  return (
    <div className="mt-3">
      {abierto ? (
        <form action={accion} className="border-t border-neutro-200 pt-3">
          <input type="hidden" name="pensionId" value={pensionId} />

          <label htmlFor={CAMPO_WHATSAPP} className={claseEtiqueta}>
            WhatsApp del anfitrión
          </label>
          <input
            id={CAMPO_WHATSAPP}
            name={CAMPO_WHATSAPP}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={16}
            required
            defaultValue={whatsappActual}
            className={claseInput}
            aria-describedby={`${CAMPO_WHATSAPP}-ayuda`}
          />
          <p id={`${CAMPO_WHATSAPP}-ayuda`} className="mt-1 text-xs leading-relaxed text-neutro-500">
            Celular de 10 dígitos que empieza por 3 (3001234567), o fijo con indicativo
            (6050000000). Al guardar sustituyes el número que el anfitrión tiene registrado; solo lo
            ve el equipo de Nido.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BotonGuardar />
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="inline-flex h-11 items-center rounded-xl border border-neutro-300 px-4 text-sm font-bold text-neutro-700 transition hover:bg-neutro-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex h-11 items-center rounded-xl border border-neutro-300 px-4 text-sm font-bold text-neutro-700 transition hover:bg-neutro-100"
        >
          Cambiar número
        </button>
      )}

      <Mensaje estado={estado} />
    </div>
  );
}

/** El botón del guardado, con su estado «guardando» para no enviar dos veces. */
function BotonGuardar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar número"}
    </button>
  );
}

/** La respuesta: verde si se guardó, roja si no. Se anuncia al lector de pantalla. */
function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (!estado.mensaje) return null;

  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold ${
        estado.ok
          ? "bg-primary-50 text-primary-800 ring-1 ring-primary-100"
          : "bg-confianza-danger/10 text-confianza-danger ring-1 ring-confianza-danger/20"
      }`}
    >
      {estado.mensaje}
    </p>
  );
}
