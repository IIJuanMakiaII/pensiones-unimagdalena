"use client";

import Link from "next/link";
import type { PensionConHabitaciones } from "@/types";
import type { FiltrosUI } from "@/lib/filtros";
import { contarDisponibles, habitacionDestacada } from "@/lib/filtros";
import { galeriaDe, precioDesde } from "@/lib/pension";
import { enlaceWhatsApp, etiquetaGenero, etiquetaTipo, formatearCOP } from "@/lib/formato";
import { medirContacto } from "@/lib/medicion";
import Carrusel from "@/components/Carrusel";
import SelloVerificado from "@/components/SelloVerificado";
import BotonFavorito from "@/components/BotonFavorito";
import Estrellas from "@/components/Estrellas";
import BadgesServicios from "@/components/BadgesServicios";

interface Props {
  pension: PensionConHabitaciones;
  filtros: FiltrosUI;
  /** Solo en la primera card (LCP). */
  prioridadImagen?: boolean;
}

/**
 * Card de pensión (§4.2): carrusel + sello, metadata, título, estrellas,
 * distancia, badges de servicios, precio "desde" y CTA de WhatsApp.
 */
export default function CardPension({ pension, filtros, prioridadImagen = false }: Props) {
  const totalHabitaciones = pension.habitaciones?.length ?? 0;
  const libres = contarDisponibles(pension);
  const destacada = habitacionDestacada(pension, filtros);

  /** Publicó el anuncio sin habitaciones (creado antes del editor de habitaciones). */
  const sinHabitacionesPublicadas = totalHabitaciones === 0;
  /** Publicó habitaciones, pero el anfitrión las marcó todas como ocupadas. */
  const sinLibres = !sinHabitacionesPublicadas && libres === 0;

  /**
   * Precio de la tarjeta = precio de la habitación que el CTA va a reservar.
   *
   * Antes se mostraba siempre la más barata en absoluto, mientras el mensaje de
   * WhatsApp hablaba de la más barata QUE CUMPLE LOS FILTROS: con "solo mujeres"
   * activo, la tarjeta decía $400.000 y el chat ofrecía una de $650.000. Ahora
   * ambos números salen de la misma habitación (`destacada`).
   *
   * Sin habitaciones publicadas se conserva el precio declarado por el anfitrión.
   * Con todas ocupadas NO se muestra precio: la base conserva el último
   * `precio_mensual` (el trigger solo lo recalcula si queda alguna disponible),
   * así que anunciarlo sería ofrecer un precio que ya no se puede reservar.
   */
  const precioMostrado = destacada
    ? destacada.precio_mensual_cop
    : sinHabitacionesPublicadas
      ? precioDesde(pension)
      : 0;

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-neutro-200 transition duration-150 hover:shadow-card-hover hover:ring-primary-200">
      {/* El enlace al detalle vive dentro de cada foto del carrusel, no
          envolviendo el carrusel: sus botones ya no quedan dentro de un <a>. */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <Carrusel
          imagenes={galeriaDe(pension)}
          altBase={pension.titulo}
          href={`/pensiones/${pension.slug}`}
          priority={prioridadImagen}
          diferirImagenes
          className="h-full w-full"
        />
        {pension.verificado && <SelloVerificado className="absolute right-3 top-3" />}
      </div>

      <div className="absolute left-3 top-3 z-10">
        <BotonFavorito pensionId={pension.id} titulo={pension.titulo} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutro-500">
          {sinHabitacionesPublicadas
            ? "Publicación nueva"
            : sinLibres
              ? "Sin habitaciones libres"
              : `${libres} hab. disponibles`}{" "}
          · {pension.barrio || "Santa Marta"}
        </p>

        <h3 className="font-display text-lg font-bold leading-snug text-neutro-800">
          <Link href={`/pensiones/${pension.slug}`} className="hover:text-primary-700">
            {pension.titulo}
          </Link>
        </h3>

        <div className="flex items-center gap-2">
          <Estrellas calificacion={pension.calificacion} />
          <span className="text-sm font-semibold text-neutro-700">
            {pension.calificacion.toFixed(1)}
          </span>
          {/* Puntaje interno verificable: no se muestran "reseñas" inventadas. */}
          <span className="text-xs text-neutro-500">Puntaje del equipo</span>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-neutro-600">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true">
            <circle cx="10" cy="10" r="7.25" />
            <path d="M10 5.5V10l3 1.75" strokeLinecap="round" />
          </svg>
          {pension.distancia_a_pie_minutos} min a pie de Unimagdalena
        </p>

        <BadgesServicios servicios={pension.servicios} />

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div>
            {precioMostrado > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutro-500">
                  {destacada ? `Desde · ${etiquetaTipo(destacada.tipo)}` : "Mensual"}
                </p>
                <p className="precio font-display text-xl font-extrabold leading-none text-accent-500">
                  {formatearCOP(precioMostrado)}
                  <span className="text-sm font-bold text-neutro-500"> /mes</span>
                </p>
              </>
            )}
          </div>
        </div>

        {destacada ? (
          <a
            href={enlaceWhatsApp(pension, destacada)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              medirContacto({
                pension: pension.id,
                origen: "tarjeta",
                propio: Boolean(pension.whatsapp),
                con_habitacion: true,
              })
            }
            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp-deep px-4 text-[15px] font-bold text-white shadow-sm transition hover:bg-whatsapp-dark"
          >
            <WhatsAppIcon />
            Reservar por WhatsApp
          </a>
        ) : sinLibres ? (
          /* Todas las habitaciones están ocupadas: ni se ofrece reservar ni se
             muestra un precio que ya no aplica. Se ofrece preguntar al anfitrión. */
          <div className="mt-3 rounded-xl border border-dashed border-neutro-300 bg-neutro-100/60 p-3 text-center">
            <p className="text-sm font-bold text-neutro-700">Sin habitaciones libres ahora</p>
            <p className="mt-0.5 text-xs text-neutro-500">
              El anfitrión las marcó como ocupadas. Pregúntale por la próxima disponibilidad.
            </p>
            <a
              href={enlaceWhatsApp(pension)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                medirContacto({
                  pension: pension.id,
                  origen: "tarjeta",
                  propio: Boolean(pension.whatsapp),
                  con_habitacion: false,
                })
              }
              className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp-deep px-4 text-[15px] font-bold text-white transition hover:bg-whatsapp-dark"
            >
              <WhatsAppIcon />
              Consultar por WhatsApp
            </a>
          </div>
        ) : sinHabitacionesPublicadas ? (
          <a
            href={enlaceWhatsApp(pension)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              medirContacto({
                pension: pension.id,
                origen: "tarjeta",
                propio: Boolean(pension.whatsapp),
                con_habitacion: false,
              })
            }
            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp-deep px-4 text-[15px] font-bold text-white shadow-sm transition hover:bg-whatsapp-dark"
          >
            <WhatsAppIcon />
            Consultar por WhatsApp
          </a>
        ) : (
          <p className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutro-100 px-4 text-[15px] font-semibold text-neutro-500">
            Sin habitaciones con estos filtros
          </p>
        )}
      </div>
    </article>
  );
}

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}
