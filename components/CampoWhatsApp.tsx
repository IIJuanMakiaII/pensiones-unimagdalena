"use client";

import { useState } from "react";
import Link from "next/link";
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
  /**
   * Consta ya una autorización registrada para publicar el número.
   *
   * La casilla **nunca viene premarcada** (una casilla ya marcada no es una
   * manifestación de voluntad), así que esto solo sirve para no pedir de nuevo
   * algo que ya se autorizó y para avisar cuando falta.
   */
  conAutorizacionPrevia?: boolean;
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
export default function CampoWhatsApp({
  valorInicial = "",
  avisaSiFalta = false,
  conAutorizacionPrevia = false,
}: Props) {
  const [valor, setValor] = useState(normalizarWhatsappPropio(valorInicial ?? ""));
  const [tocado, setTocado] = useState(false);

  const valido = whatsappPropioValido(valor);
  const mostrarError = tocado && !valido;

  return (
    <div>
      <label htmlFor="whatsapp" className={claseEtiqueta}>
        Tu WhatsApp para esta pensión
      </label>
      {/* Texto acordado en docs/legales/autorizacion-anfitrion.md §4: hay que decir
          la parte importante —que el número se publica—, no solo dónde se usa. */}
      <p className="mt-0.5 text-xs text-neutro-500">
        Este número aparecerá <strong className="font-semibold">en tu anuncio, a la vista de
        cualquiera</strong>. Es a donde escribirán los estudiantes. No entra en los datos que leen
        los buscadores.
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

      {/* Autorización expresa: sin ella no se publica el número, y no basta con el
          formulario — la base también la exige (supabase/oleada-6.sql). El texto
          es el de docs/legales/autorizacion-anfitrion.md §2, literal. */}
      <div className="mt-3 rounded-xl border border-neutro-200 bg-neutro-50 p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="autorizaContacto"
            value="si"
            required
            aria-describedby="autorizacion-detalle"
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary-600"
          />
          <span className="text-sm leading-relaxed text-neutro-700">
            <strong className="block font-semibold text-neutro-900">
              Autorizo que mi número de WhatsApp quede publicado en este anuncio
            </strong>
            Entiendo que ese número quedará visible para cualquier persona que abra la página de mi
            pensión, y que también podrá verlo quien consulte los datos del sitio directamente,
            aunque no tenga cuenta. Entiendo que el contacto se hará por WhatsApp, fuera de la
            plataforma, y que la plataforma no lee, no guarda ni controla esas conversaciones.
            Entiendo que puedo retirar esta autorización cuando quiera, retirando el anuncio o
            pidiendo que se cambie mi número, y que desde ese momento dejará de ser público.
          </span>
        </label>
        <p id="autorizacion-detalle" className="mt-2 text-xs text-neutro-500">
          Puedes leer el{" "}
          <Link
            href="/legal/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-primary-700 underline underline-offset-2"
          >
            aviso de privacidad
          </Link>{" "}
          antes de decidir. Tu decisión queda registrada con fecha.
        </p>
      </div>

      {avisaSiFalta && !normalizarWhatsappPropio(valorInicial ?? "") && (
        <p className="mt-2 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-3 py-2 text-xs font-semibold text-neutro-700">
          Este anuncio todavía no tiene número propio: hoy las reservas llegan al WhatsApp de la
          plataforma. Añade el tuyo para recibirlas directamente.
        </p>
      )}

      {/* Anuncio heredado: tiene número pero se publicó antes de que esto se
          preguntara. No se supone un consentimiento anterior (ver §3.4 del
          documento): hay que autorizarlo de nuevo, aquí. */}
      {normalizarWhatsappPropio(valorInicial ?? "") !== "" && !conAutorizacionPrevia && (
        <p className="mt-2 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-3 py-2 text-xs font-semibold text-neutro-700">
          Este anuncio ya tenía un número guardado, de cuando no se pedía esta autorización. Para
          seguir publicándolo necesitamos que marques la casilla de arriba: hasta entonces no se
          publicará tu número.
        </p>
      )}
    </div>
  );
}
