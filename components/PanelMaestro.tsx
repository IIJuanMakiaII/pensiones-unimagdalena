"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { Habitacion, PensionConHabitaciones } from "@/types";
import {
  borrarPensionMaestro,
  cambiarDisponibilidadMaestro,
  cambiarEstadoPublicacionMaestro,
} from "@/app/actions/maestro";
import { PALABRA_DE_BORRADO } from "@/lib/borrado";
import type { EstadoFormulario } from "@/lib/pension-escritura";
import { etiquetaGenero, etiquetaTipo, formatearCOP } from "@/lib/formato";

/**
 * La tarjeta de administración de una publicación en el panel del maestro.
 *
 * Cada control es un formulario que envía a una Server Action: no hay `fetch` ni
 * lógica de permisos en el navegador. Este componente **no decide nada** sobre
 * quién puede escribir; el servidor vuelve a preguntar por el perfil maestro en
 * cada acción, de modo que un anfitrión que consiguiera llegar hasta aquí no
 * lograría nada enviando el formulario a mano.
 *
 * Por eso tampoco recibe el rol como prop: si lo recibiera, parecería que el
 * navegador tiene voz en esa decisión.
 */
const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensaje: null };

export default function PanelMaestro({ pension }: { pension: PensionConHabitaciones }) {
  const habitaciones = pension.habitaciones ?? [];
  const libres = habitaciones.filter((habitacion) => habitacion.disponible);
  const preciosLibres = libres.map((habitacion) => habitacion.precio_mensual_cop);
  const precioDesdeLibre = preciosLibres.length > 0 ? Math.min(...preciosLibres) : 0;

  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-neutro-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-neutro-800">{pension.titulo}</h3>
          <p className="mt-0.5 text-xs text-neutro-500">
            {pension.barrio || "Santa Marta"} ·{" "}
            <span className="break-all">/pensiones/{pension.slug}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              pension.activa
                ? "bg-primary-50 text-primary-800 ring-1 ring-primary-100"
                : "bg-neutro-100 text-neutro-600 ring-1 ring-neutro-200"
            }`}
          >
            {pension.activa ? "Publicada" : "Retirada"}
          </span>
          <span className="rounded-full bg-neutro-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-neutro-600">
            {libres.length} de {habitaciones.length} libres
          </span>
        </div>
      </div>

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
          Esta publicación no tiene habitaciones, así que el catálogo no puede filtrarla por tipo,
          género ni precio. Añádelas desde «Editar anuncio».
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {habitaciones.map((habitacion) => (
            <FilaHabitacionMaestro
              key={habitacion.id}
              habitacion={habitacion}
              pensionId={pension.id}
            />
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-neutro-200 pt-4">
        <AccionesMaestro pension={pension} />
      </div>
    </article>
  );
}

/** Una habitación con su acción de disponibilidad, válida para cualquier anuncio. */
function FilaHabitacionMaestro({
  habitacion,
  pensionId,
}: {
  habitacion: Habitacion;
  pensionId: string;
}) {
  const [estado, accion] = useFormState(cambiarDisponibilidadMaestro, ESTADO_INICIAL);
  const descripcion = `${etiquetaTipo(habitacion.tipo)} · ${etiquetaGenero(habitacion.genero)}`;
  const siguienteDisponible = !habitacion.disponible;

  return (
    <li className="rounded-xl border border-neutro-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutro-800">
            {descripcion}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
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
          <input type="hidden" name="pensionId" value={pensionId} />
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

/** Retirar, reactivar, editar y borrar el anuncio completo. */
function AccionesMaestro({ pension }: { pension: PensionConHabitaciones }) {
  const [estado, accion] = useFormState(cambiarEstadoPublicacionMaestro, ESTADO_INICIAL);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <form action={accion}>
          <input type="hidden" name="pensionId" value={pension.id} />
          <input type="hidden" name="activa" value={pension.activa ? "0" : "1"} />
          <BotonAccion
            etiqueta={pension.activa ? "Retirar publicación" : "Volver a publicar"}
            ariaLabel={
              pension.activa
                ? `Retirar «${pension.titulo}» para que deje de aparecer en el catálogo`
                : `Volver a publicar «${pension.titulo}» en el catálogo`
            }
            tono={pension.activa ? "neutral" : "confirmar"}
          />
        </form>

        {/* Editar está siempre disponible: un anuncio retirado también necesita
            corregirse antes de volver a publicarlo. */}
        <Link
          href={`/maestro/${pension.id}/editar`}
          className="inline-flex h-11 items-center rounded-xl border border-primary-600 px-4 text-sm font-bold text-primary-700 transition hover:bg-primary-50"
        >
          Editar anuncio
        </Link>

        {pension.activa ? (
          <Link
            href={`/pensiones/${pension.slug}`}
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

      <div className="mt-4 border-t border-dashed border-neutro-200 pt-4">
        {confirmandoBorrado ? (
          <ConfirmarBorrado
            pension={pension}
            onCancelar={() => setConfirmandoBorrado(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            aria-label={`Borrar definitivamente «${pension.titulo}»`}
            className="inline-flex h-11 items-center rounded-xl border border-confianza-danger/40 px-4 text-sm font-bold text-confianza-danger transition hover:bg-confianza-danger/10"
          >
            Borrar anuncio
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * El paso previo del borrado: nombrar el anuncio y decir qué se pierde.
 *
 * Este bloque vive en el cliente y por eso **no es la garantía** de nada: existe
 * para que nadie borre por accidente, no para impedir un borrado. Quien impide de
 * verdad es el servidor, que exige la palabra escrita aquí abajo y el perfil
 * maestro, y que borra por la función de la base que conserva la reserva de la
 * dirección.
 *
 * El texto es deliberadamente explícito en las dos direcciones: qué muere (el
 * anuncio y su dirección, para siempre) y qué **no** muere (las fotos, que se
 * quedan en el almacenamiento sin nada que las use). Un aviso a medias sería
 * peor que ninguno.
 */
function ConfirmarBorrado({
  pension,
  onCancelar,
}: {
  pension: PensionConHabitaciones;
  onCancelar: () => void;
}) {
  const [estado, accion] = useFormState(borrarPensionMaestro, ESTADO_INICIAL);
  const idConfirmacion = `confirmacion-${pension.id}`;

  return (
    <div
      role="group"
      aria-label={`Confirmar el borrado de ${pension.titulo}`}
      className="rounded-xl border border-confianza-danger/40 bg-confianza-danger/5 p-4"
    >
      <p className="text-sm font-bold text-neutro-900">
        Vas a borrar «{pension.titulo}»
      </p>

      <p className="mt-1 text-base leading-relaxed text-neutro-700">
        Esta publicación desaparece del catálogo y <strong>no tiene vuelta atrás</strong>.
      </p>

      <ul className="mt-2 list-disc space-y-1 pl-5 text-base leading-relaxed text-neutro-700">
        <li>
          Su dirección <strong className="break-all">/pensiones/{pension.slug}</strong> queda muerta
          para siempre: el sistema reserva las direcciones de lo que se borra y no las vuelve a
          usar, así que ese enlace no funcionará nunca más.
        </li>
        <li>
          Las <strong>fotos no se borran</strong>: siguen guardadas en el almacenamiento, sin nada
          que las use. Limpiarlas es otra tarea.
        </li>
        <li>
          El propietario deja de ver la publicación en su panel y no puede recuperarla.
        </li>
      </ul>

      <form action={accion} className="mt-4">
        <input type="hidden" name="pensionId" value={pension.id} />

        <label htmlFor={idConfirmacion} className="block text-sm font-semibold text-neutro-800">
          Escribe {PALABRA_DE_BORRADO} para confirmar
        </label>
        <input
          id={idConfirmacion}
          name="confirmacion"
          type="text"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={PALABRA_DE_BORRADO}
          className="mt-1 h-11 w-full max-w-[12rem] rounded-xl border border-neutro-300 px-3 text-sm font-semibold uppercase tracking-wide text-neutro-900 focus:border-confianza-danger focus:outline-none focus:ring-2 focus:ring-confianza-danger/30"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <BotonBorrar />
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex h-11 items-center rounded-xl border border-neutro-300 px-4 text-sm font-bold text-neutro-700 transition hover:bg-neutro-100"
          >
            Cancelar
          </button>
        </div>

        <MensajeAccion estado={estado} />
      </form>
    </div>
  );
}

/** Botón de envío con estado «guardando» (evita envíos dobles). */
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

/** El botón del borrado: sólido y en rojo, para que no se pulse por inercia. */
function BotonBorrar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-xl bg-confianza-danger px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Borrando…" : "Borrar definitivamente"}
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
