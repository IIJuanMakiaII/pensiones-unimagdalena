"use client";

import { useState } from "react";
import type { PensionConHabitaciones } from "@/types";
import {
  enlaceWhatsApp,
  etiquetaGenero,
  etiquetaTipo,
  formatearCOP,
} from "@/lib/formato";
import { WhatsAppIcon } from "@/components/CardPension";

interface Props {
  pension: PensionConHabitaciones;
}

/**
 * Selección de habitación + CTAs de WhatsApp (§4.5).
 * Sticky bottom bar en móvil con el precio de la habitación seleccionada.
 * Los precios en tamaño pequeño usan accent-700 para cumplir WCAG AA (4.5:1).
 */
export default function DetallePension({ pension }: Props) {
  const disponibles = pension.habitaciones.filter((h) => h.disponible);
  const agotadas = pension.habitaciones.filter((h) => !h.disponible);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(
    disponibles[0]?.id ?? null
  );
  const seleccionada = pension.habitaciones.find(
    (h) => h.id === seleccionadaId
  );

  return (
    <div className="pb-28 md:pb-0">
      <h2 className="font-display text-xl font-bold text-neutro-800">
        Habitaciones disponibles
      </h2>

      <div role="radiogroup" aria-label="Elige una habitación" className="mt-4 space-y-3">
        {disponibles.map((h) => {
          const activa = h.id === seleccionadaId;
          return (
            <div
              key={h.id}
              className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-4 transition ${
                activa
                  ? "border-primary-500 shadow-card-hover"
                  : "border-neutro-200 hover:border-primary-300"
              }`}
            >
              {/*
                El botón de reserva va FUERA del <label>. Antes estaba dentro y
                pulsarlo marcaba también el radio (el label activa su control) y
                el texto "Reservar" se sumaba al nombre accesible de la opción.
              */}
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="habitacion"
                  value={h.id}
                  checked={activa}
                  onChange={() => setSeleccionadaId(h.id)}
                  className="h-5 w-5 shrink-0 accent-primary-600"
                />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] font-bold text-neutro-800">
                      {etiquetaTipo(h.tipo)} · {etiquetaGenero(h.genero)}
                    </span>
                    {h.alimentacion_incluida && (
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-800 ring-1 ring-primary-100">
                        Con alimentación
                      </span>
                    )}
                  </span>
                  <span className="precio mt-1 block text-lg font-extrabold text-accent-700">
                    {formatearCOP(h.precio_mensual_cop)}
                    <span className="text-sm font-bold text-neutro-500"> /mes</span>
                  </span>
                </span>
              </label>

              <a
                href={enlaceWhatsApp(pension, h)}
                target="_blank"
                rel="noopener noreferrer"
                /* Mantiene sincronizada la barra fija del móvil con lo reservado. */
                onClick={() => setSeleccionadaId(h.id)}
                aria-label={`Reservar ${etiquetaTipo(h.tipo)} ${etiquetaGenero(h.genero)} por WhatsApp`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-whatsapp-deep px-4 text-sm font-bold text-white transition hover:bg-whatsapp-dark"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Reservar
              </a>
            </div>
          );
        })}
      </div>

      {disponibles.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-neutro-300 bg-white p-5">
          {pension.habitaciones.length === 0 ? (
            <p className="text-sm leading-relaxed text-neutro-600">
              Este anfitrión todavía no publicó habitaciones con tipo, género y precio.
              Escríbele para conocer la disponibilidad y el precio exacto.
            </p>
          ) : (
            /* Distinto de "no publicó habitaciones": aquí sí las hay, pero el
               anfitrión las marcó todas como ocupadas. */
            <>
              <p className="font-display text-base font-bold text-neutro-800">
                Sin habitaciones libres ahora
              </p>
              <p className="mt-1 text-sm leading-relaxed text-neutro-600">
                El anfitrión marcó todas sus habitaciones como ocupadas. Pregúntale por la
                próxima disponibilidad o por otras opciones del mismo alojamiento.
              </p>
            </>
          )}
          <a
            href={enlaceWhatsApp(pension)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-whatsapp-deep px-5 text-[15px] font-bold text-white transition hover:bg-whatsapp-dark"
          >
            <WhatsAppIcon />
            Consultar por WhatsApp
          </a>
        </div>
      )}

      {agotadas.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutro-500">
            Ocupadas por ahora
          </h3>
          <ul className="mt-2 space-y-2">
            {agotadas.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-2xl border border-neutro-200 bg-neutro-100/60 px-4 py-3 text-sm text-neutro-500"
              >
                <span>
                  {etiquetaTipo(h.tipo)} · {etiquetaGenero(h.genero)}
                </span>
                <span className="rounded-full bg-confianza-danger/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-confianza-danger">
                  Agotado
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sticky bottom bar (móvil): precio + CTA WhatsApp siempre visibles */}
      {seleccionada && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutro-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-neutro-500">
                {etiquetaTipo(seleccionada.tipo)} · {etiquetaGenero(seleccionada.genero)}
              </p>
              <p className="precio font-display text-lg font-extrabold leading-tight text-accent-700">
                {formatearCOP(seleccionada.precio_mensual_cop)}
                <span className="text-sm font-bold text-neutro-500"> /mes</span>
              </p>
            </div>
            <a
              href={enlaceWhatsApp(pension, seleccionada)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-whatsapp-deep px-5 text-[15px] font-bold text-white shadow-lg transition hover:bg-whatsapp-dark"
            >
              <WhatsAppIcon />
              Reservar
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
