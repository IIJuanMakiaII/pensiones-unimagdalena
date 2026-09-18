"use client";

import { useState } from "react";
import {
  DIGITOS_WHATSAPP,
  MENSAJE_WHATSAPP_INVALIDO,
  normalizarWhatsappPropio,
  whatsappPropioValido,
} from "@/lib/formato";
import { claseEtiqueta } from "@/lib/formulario-pension";

interface Props {
  /** Número ya guardado (10 dígitos) al editar; vacío al publicar. */
  valorInicial?: string | null;
  /** Al editar un anuncio que aún no tiene número propio, avisa de las consecuencias. */
  avisaSiFalta?: boolean;
}

/**
 * Campo del WhatsApp propio de una pensión.
 *
 * Lo comparten el formulario de publicación y el editor (tarea #19): un solo
 * componente y una sola validación, para que las dos pantallas no puedan
 * divergir. Normaliza mientras se escribe —quita `+57`, espacios, guiones y
 * paréntesis— porque la base exige exactamente 10 dígitos y rechazaría el
 * formato en que la gente escribe su número.
 */
export default function CampoWhatsApp({ valorInicial = "", avisaSiFalta = false }: Props) {
  const [valor, setValor] = useState(normalizarWhatsappPropio(valorInicial ?? ""));
  const [tocado, setTocado] = useState(false);

  const valido = whatsappPropioValido(valor);
  const mostrarError = tocado && !valido;

  return (
    <div>
      <label htmlFor="whatsapp" className={claseEtiqueta}>
        Tu WhatsApp para esta pensión
      </label>
      <p className="mt-0.5 text-xs text-neutro-500">
        Es el número que se abre cuando el estudiante pulsa «Reservar». Solo se usa para eso: no
        aparece en los datos que leen los buscadores.
      </p>

      <div className="mt-1 flex items-stretch overflow-hidden rounded-xl border border-neutro-300 bg-neutro-50 focus-within:border-primary-600 focus-within:bg-white">
        <span
          aria-hidden="true"
          className="flex items-center border-r border-neutro-200 px-3 text-sm font-semibold text-neutro-500"
        >
          +57
        </span>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          maxLength={DIGITOS_WHATSAPP + 6}
          value={valor}
          onChange={(evento) =>
            setValor(normalizarWhatsappPropio(evento.target.value).slice(0, DIGITOS_WHATSAPP))
          }
          onBlur={() => setTocado(true)}
          aria-invalid={mostrarError}
          aria-describedby="whatsapp-ayuda"
          placeholder="300 123 4567"
          className="w-full bg-transparent px-3 py-3 text-neutro-900 outline-none"
        />
      </div>

      {mostrarError ? (
        <p
          id="whatsapp-ayuda"
          role="alert"
          className="mt-1 text-xs font-semibold text-confianza-danger"
        >
          {MENSAJE_WHATSAPP_INVALIDO}
        </p>
      ) : (
        <p id="whatsapp-ayuda" className="mt-1 text-xs text-neutro-500">
          {valido
            ? `El botón de reserva abrirá el chat del +57 ${valor}.`
            : `${valor.length}/${DIGITOS_WHATSAPP} dígitos · por ejemplo 300 123 4567`}
        </p>
      )}

      {avisaSiFalta && !normalizarWhatsappPropio(valorInicial ?? "") && (
        <p className="mt-2 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-3 py-2 text-xs font-semibold text-neutro-700">
          Este anuncio todavía no tiene número propio: hoy las reservas llegan al WhatsApp de la
          plataforma. Añade el tuyo para recibirlas directamente.
        </p>
      )}
    </div>
  );
}
