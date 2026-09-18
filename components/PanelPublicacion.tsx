"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { Habitacion, PensionConHabitaciones } from "@/types";
import {
  cambiarDisponibilidadHabitacion,
  cambiarEstadoPublicacion,
} from "@/app/actions/pensiones";
import type { EstadoFormulario } from "@/app/actions/pensiones";
import { etiquetaGenero, etiquetaTipo, formatearCOP } from "@/lib/formato";

/**
 * Estado inicial de los formularios del panel. Vive aquí (no en el módulo de
 * acciones) porque un archivo "use server" solo puede exportar funciones
 * asíncronas: al importarlo desde allí llegaría al cliente como referencia de
 * servidor.
 */
const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensaje: null };

interface Props {
  pension: PensionConHabitaciones;
}

/**
 * Gestión de una publicación ya creada: marcar cada habitación como libre u
 * ocupada y retirar o reactivar el anuncio.
 *
 * Toda la escritura pasa por Server Actions (nunca por `fetch` desde el
 * cliente) y la autorización se resuelve en el servidor: si la habitación o la
 * publicación no son del anfitrión autenticado, la acción devuelve un error
 * visible en lugar de un éxito falso.
 */
export default function PanelPublicacion({ pension }: Props) {
  const habitaciones = pension.habitaciones ?? [];
  const libres = habitaciones.filter((h) => h.disponible);
  const preciosLibres = libres.map((h) => h.precio_mensual_cop);
  const precioDesdeLibre = preciosLibres.length > 0 ? Math.min(...preciosLibres) : 0;

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-neutro-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold text-neutro-800">{pension.titulo}</p>
          <p className="mt-0.5 text-xs text-neutro-500">{pension.barrio || "Santa Marta"}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              pension.activa
                ? "bg-primary-50 text-primary-800 ring-1 ring-primary-100"
                : "bg-neutro-100 text-neutro-600 ring-1 ring-neutro-200"
            }`}
          >
            {pension.activa ? "Publicada" : "Retirada"}
          </span>
          <span className="rounded-full bg-neutro-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-neutro-600">
            {libres.length} de {habitaciones.length} libres
          </span>
        </div>
      </div>

      {/* Precio "desde" real: solo se anuncia si hay alguna habitación libre que
          se pueda reservar. Con todas ocupadas no se muestra un precio que ya no
          aplica (el trigger de la base conserva el último valor). */}
      {precioDesdeLibre > 0 ? (
        <p className="precio mt-2 text-sm font-bold text-accent-700">
          Desde {formatearCOP(precioDesdeLibre)}
          <span className="font-semibold text-neutro-500"> /mes</span>
        </p>
      ) : (
        <p className="mt-2 text-sm font-semibold text-neutro-500">
          {habitaciones.length === 0
            ? "Sin habitaciones publicadas"
            : "Sin habitaciones libres: no se muestra precio en el catálogo"}
        </p>
      )}

      {habitaciones.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-neutro-300 bg-neutro-50 p-3 text-xs leading-relaxed text-neutro-600">
          Esta publicación se creó antes de que el formulario pidiera habitaciones, así que los
          estudiantes no pueden filtrarla por tipo, género ni precio. Publícala de nuevo para que
          aparezca con filtros.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {habitaciones.map((habitacion) => (
            <FilaHabitacion key={habitacion.id} habitacion={habitacion} />
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-neutro-200 pt-4">
        <AccionesPublicacion pensionId={pension.id} activa={pension.activa} />
      </div>
    </div>
  );
}

/** Una habitación con su acción de disponibilidad y su propio estado de envío. */
function FilaHabitacion({ habitacion }: { habitacion: Habitacion }) {
  const [estado, accion] = useFormState(cambiarDisponibilidadHabitacion, ESTADO_INICIAL);
  const descripcion = `${etiquetaTipo(habitacion.tipo)} · ${etiquetaGenero(habitacion.genero)}`;
  const siguienteDisponible = !habitacion.disponible;

  return (
    <li className="rounded-xl border border-neutro-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutro-800">
            {descripcion}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                habitacion.disponible
                  ? "bg-primary-50 text-primary-800 ring-1 ring-primary-100"
                  : "bg-confianza-danger/10 text-confianza-danger"
              }`}
            >
              {habitacion.disponible ? "Libre" : "Ocupada"}
            </span>
          </p>
          <p className="precio mt-0.5 text-xs font-semibold text-neutro-500">
            {formatearCOP(habitacion.precio_mensual_cop)} /mes
            {habitacion.alimentacion_incluida ? " · con alimentación" : ""}
          </p>
        </div>

        <form action={accion}>
          <input type="hidden" name="habitacionId" value={habitacion.id} />
          <input type="hidden" name="disponible" value={siguienteDisponible ? "1" : "0"} />
          <BotonAccion
            etiqueta={siguienteDisponible ? "Marcar libre" : "Marcar ocupada"}
            ariaLabel={
              siguienteDisponible
                ? `Marcar como libre la habitación ${descripcion}`
                : `Marcar como ocupada la habitación ${descripcion}`
            }
            tono={siguienteDisponible ? "confirmar" : "neutral"}
          />
        </form>
      </div>

      <MensajeAccion estado={estado} />
    </li>
  );
}

/** Retirar o volver a publicar el anuncio completo. */
function AccionesPublicacion({ pensionId, activa }: { pensionId: string; activa: boolean }) {
  const [estado, accion] = useFormState(cambiarEstadoPublicacion, ESTADO_INICIAL);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={accion}>
          <input type="hidden" name="pensionId" value={pensionId} />
          <input type="hidden" name="activa" value={activa ? "0" : "1"} />
          <BotonAccion
            etiqueta={activa ? "Retirar publicación" : "Volver a publicar"}
            ariaLabel={
              activa
                ? "Retirar la publicación para que deje de aparecer en el catálogo"
                : "Volver a publicar el anuncio en el catálogo"
            }
            tono={activa ? "neutral" : "confirmar"}
          />
        </form>

        {/* El enlace al catálogo solo aparece si la publicación está activa: una
            publicación retirada no es accesible al público, así que enlazarla
            llevaría a un 404. */}
        {activa ? (
          <Link
            href={`/pensiones/${pensionId}`}
            className="inline-flex h-11 items-center rounded-xl bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700"
          >
            Ver en el catálogo
          </Link>
        ) : (
          <p className="text-xs text-neutro-500">
            Está retirada: no aparece en el catálogo ni es accesible al público.
          </p>
        )}
      </div>

      <MensajeAccion estado={estado} />
    </div>
  );
}

/** Botón de envío con estado "guardando" (evita envíos dobles). */
function BotonAccion({
  etiqueta,
  ariaLabel,
  tono,
}: {
  etiqueta: string;
  ariaLabel: string;
  tono: "confirmar" | "neutral";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={ariaLabel}
      className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        tono === "confirmar"
          ? "bg-primary-600 text-white hover:bg-primary-700"
          : "border border-neutro-300 text-neutro-700 hover:bg-neutro-100"
      }`}
    >
      {pending ? "Guardando…" : etiqueta}
    </button>
  );
}

/** Respuesta de la acción: éxito (status) o error (alert), anunciada al lector de pantalla. */
function MensajeAccion({ estado }: { estado: EstadoFormulario }) {
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
