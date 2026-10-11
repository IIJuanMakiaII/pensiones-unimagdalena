import Link from "next/link";
import { enviarContactoRespaldo } from "@/app/actions/contacto";
import { LIMITE_MENSAJE, LIMITE_NOMBRE } from "@/lib/contacto-respaldo";

interface Props {
  /** Dirección pública del anuncio desde el que se llegó, si se llegó desde uno. */
  pension?: string;
  /** Lo que ya venía escrito, para no pedirle a la persona que se repita. */
  mensajeInicial?: string;
}

/**
 * Formulario de respaldo del contacto (tarea #59).
 *
 * POR QUÉ ES UN COMPONENTE DE SERVIDOR
 * -----------------------------------
 * No lleva `"use client"` a propósito. El `action` apunta a una Server Action,
 * así que el navegador manda un `POST` normal y el resultado vuelve como una
 * página nueva. Eso significa que **funciona con el JavaScript desactivado**, sin
 * código extra: es el mismo mecanismo, no una versión degradada que haya que
 * mantener aparte. El respaldo del canal de contacto no puede depender del
 * script que podría ser justamente lo que falló.
 *
 * El estilo de los campos y de los avisos es el de `FormularioRegistro`, para que
 * un formulario de Nido se reconozca como tal.
 */
export default function FormularioContactoRespaldo({ pension, mensajeInicial = "" }: Props) {
  return (
    <form
      action={enviarContactoRespaldo}
      className="w-full rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200 md:p-8"
    >
      {pension ? <input type="hidden" name="pension" value={pension} /> : null}

      {/*
        Trampa para robots. Fuera de la pantalla y fuera del orden de tabulación:
        ninguna persona puede llegar a ella y quien rellene el formulario con el
        teclado o con un lector de pantalla no la encuentra. Los guiones de
        relleno automático sí la rellenan, y ahí se cae.
      */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="empresa">No rellenes este campo</label>
        <input id="empresa" name="empresa" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="nombre" className="block text-sm font-semibold text-neutro-700">
          Tu nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          maxLength={LIMITE_NOMBRE}
          autoComplete="name"
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
        />
      </div>

      <div className="mt-4">
        <label htmlFor="contacto" className="block text-sm font-semibold text-neutro-700">
          Tu correo o tu teléfono
        </label>
        <input
          id="contacto"
          name="contacto"
          type="text"
          required
          autoComplete="email"
          aria-describedby="ayuda-contacto"
          className="mt-1 h-12 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
        />
        <p id="ayuda-contacto" className="mt-1 text-sm text-neutro-600">
          Sirve cualquiera de los dos. Lo usamos solo para responderte.
        </p>
      </div>

      <div className="mt-4">
        <label htmlFor="mensaje" className="block text-sm font-semibold text-neutro-700">
          ¿Qué necesitas? <span className="font-normal text-neutro-600">(opcional)</span>
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          rows={4}
          maxLength={LIMITE_MENSAJE}
          defaultValue={mensajeInicial}
          className="mt-1 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 py-2 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white"
        />
      </div>

      {/*
        La autorización es una casilla y no una frase al pie porque tiene que poder
        negarse. La Ley 1581 de 2012 exige una autorización previa, expresa e
        informada, y el servidor la vuelve a comprobar: sin ella no se guarda nada.
      */}
      <div className="mt-4 flex items-start gap-3">
        <input
          id="consentimiento"
          name="consentimiento"
          type="checkbox"
          required
          className="mt-1 h-5 w-5 shrink-0 rounded border-neutro-300 text-primary-600 focus:border-primary-600"
        />
        <label htmlFor="consentimiento" className="text-sm leading-relaxed text-neutro-700">
          Autorizo a Nido para tratar mis datos personales con la única finalidad de
          contactarme sobre mi búsqueda de alojamiento, conforme al{" "}
          <Link href="/legal/privacidad" className="font-semibold text-primary-700 underline">
            Aviso de privacidad
          </Link>
          . Puedo pedir que los corrijan o los borren cuando quiera.
        </label>
      </div>

      <button
        type="submit"
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary-600 px-6 text-base font-bold text-white transition hover:bg-primary-700 sm:w-auto"
      >
        Enviar mis datos
      </button>

      <p className="mt-3 text-sm text-neutro-600">
        Deja tus datos y te escribimos nosotros. Si prefieres hablar ya, arriba tienes
        WhatsApp.
      </p>
    </form>
  );
}
