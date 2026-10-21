"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { Habitacion, PensionConHabitaciones } from "@/types";
import {
  cambiarDisponibilidadHabitacion,
  cambiarEstadoPublicacion,
  liberarReservaDeMiHabitacion,
} from "@/app/actions/pensiones";
import type { EstadoFormulario } from "@/lib/pension-escritura";
import { estadoDeLaHabitacion, type ReservasPorHabitacion } from "@/lib/reserva";
import {
  etiquetaGenero,
  etiquetaTipo,
  formatearCOP,
  formatearFechaReserva,
} from "@/lib/formato";

/**
 * Estado inicial de los formularios del panel. Vive aquí (no en el módulo de
 * acciones) porque un archivo "use server" solo puede exportar funciones
 * asíncronas: al importarlo desde allí llegaría al cliente como referencia de
 * servidor.
 */
const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensaje: null };

interface Props {
  pension: PensionConHabitaciones;
  /**
   * Las reservas vigentes de **este** anuncio, con su fecha (tarea #122).
   *
   * Sin esto el panel no puede distinguir «reservada» de «apagada por el
   * anfitrión»: las dos tienen `disponible = false`, y la columna no dice cuál es
   * cuál. Lo resuelve `public.listar_reservas()`, que es la única lectura posible
   * —`reservada_en` no tiene `SELECT` para `authenticated`—. Llega ya recortado por
   * anuncio, así que esta tarjeta no ve las fechas de las demás.
   */
  reservas: ReservasPorHabitacion;
}

/**
 * Gestión de una publicación ya creada: ofrecer o retirar cada habitación, liberar
 * una reserva propia y retirar o reactivar el anuncio.
 *
 * Toda la escritura pasa por Server Actions (nunca por `fetch` desde el
 * cliente) y la autorización se resuelve en el servidor: si la habitación o la
 * publicación no son del anfitrión autenticado, la acción devuelve un error
 * visible en lugar de un éxito falso.
 */
export default function PanelPublicacion({ pension, reservas }: Props) {
  const habitaciones = pension.habitaciones ?? [];
  const libres = habitaciones.filter((h) => h.disponible);
  const preciosLibres = libres.map((h) => h.precio_mensual_cop);
  const precioDesdeLibre = preciosLibres.length > 0 ? Math.min(...preciosLibres) : 0;

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-neutro-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-neutro-800">{pension.titulo}</p>
          <p className="mt-0.5 text-xs text-neutro-500">{pension.barrio || "Santa Marta"}</p>
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

      {/* Precio "desde" real: solo se anuncia si hay alguna habitación libre que
          se pueda reservar. Con todas reservadas no se muestra un precio que ya no
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
            <FilaHabitacion
              key={habitacion.id}
              habitacion={habitacion}
              reservadaEn={reservas[habitacion.id] ?? null}
            />
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-neutro-200 pt-4">
        <AccionesPublicacion
          pensionId={pension.id}
          slug={pension.slug}
          activa={pension.activa}
        />
      </div>
    </div>
  );
}

/**
 * Una habitación con su acción y su propio estado de envío.
 *
 * TRES ESTADOS, DOS PUERTAS DE ESCRITURA (tarea #122)
 * -------------------------------------------------
 * `apagada` (`disponible = false` sin reserva) y `reservada` (`disponible = false`
 * **con** reserva) se veían iguales en esta pantalla, y durante un tiempo la
 * segunda se comió a la primera: se retiró el botón que volvía a ofrecer una
 * habitación apagada, y encima se la llamaba «reservada». La base nunca lo pidió
 * —la restricción solo prohíbe encender una habitación **con reserva**—, así que
 * el defecto era de aquí. Ahora:
 *
 *   libre     → «Retirar de la oferta»   · `disponible = false` por la columna
 *   apagada   → «Volver a ofrecer»       · `disponible = true` por la columna
 *   reservada → «Liberar reserva»        · `liberar_habitacion_reservada`, la función
 *
 * La tercera va por la función y no por la columna porque una reserva son tres
 * columnas coherentes y la función las devuelve a su valor previo en la misma
 * transacción; escribir `disponible = true` a mano choca con
 * `habitaciones_reservada_no_se_ofrece` y devuelve un `23514`.
 *
 * Quién puede: el servidor lo vuelve a decidir en las dos acciones, comparando la
 * pensión de la habitación con las publicaciones de la sesión. Aquí no hay ninguna
 * comprobación de permisos, y es a propósito: un componente de cliente no decide
 * quién escribe.
 *
 * «Reservada» solo se dice cuando hay reserva. Es la lista de
 * `listar_reservas()` la que lo decide, no la columna `disponible`.
 */
function FilaHabitacion({
  habitacion,
  reservadaEn,
}: {
  habitacion: Habitacion;
  /** Fecha de la reserva vigente, o `null` si la habitación no está reservada. */
  reservadaEn: string | null;
}) {
  const [estadoApagar, accionApagar] = useFormState(
    cambiarDisponibilidadHabitacion,
    ESTADO_INICIAL
  );
  const [estadoLiberar, accionLiberar] = useFormState(
    liberarReservaDeMiHabitacion,
    ESTADO_INICIAL
  );

  const descripcion = `${etiquetaTipo(habitacion.tipo)} · ${etiquetaGenero(habitacion.genero)}`;
  const situacion = estadoDeLaHabitacion(habitacion.disponible, reservadaEn);

  // El mensaje que se enseña es el del formulario que se acaba de enviar: si se
  // pintaran los dos, el de una acción vieja aparecería bajo un botón que no es.
  const estado = situacion === "reservada" ? estadoLiberar : estadoApagar;
  const accion = situacion === "reservada" ? accionLiberar : accionApagar;

  const etiqueta =
    situacion === "reservada"
      ? "Liberar reserva"
      : situacion === "apagada"
        ? "Volver a ofrecer"
        : "Retirar de la oferta";

  const insignia =
    situacion === "reservada"
      ? { texto: "Reservada", clase: "bg-confianza-danger/10 text-confianza-danger" }
      : situacion === "apagada"
        ? { texto: "No se ofrece", clase: "bg-neutro-100 text-neutro-600 ring-1 ring-neutro-200" }
        : { texto: "Libre", clase: "bg-primary-50 text-primary-800 ring-1 ring-primary-100" };

  const fecha = formatearFechaReserva(reservadaEn);

  return (
    <li className="rounded-xl border border-neutro-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutro-800">
            {descripcion}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${insignia.clase}`}
            >
              {insignia.texto}
            </span>
          </p>
          <p className="precio mt-0.5 text-xs font-semibold text-neutro-500">
            {formatearCOP(habitacion.precio_mensual_cop)} /mes
            {habitacion.alimentacion_incluida ? " · con alimentación" : ""}
          </p>
          {situacion === "reservada" && fecha ? (
            <p className="mt-1 text-xs font-semibold text-neutro-600">Reservada el {fecha}.</p>
          ) : null}
          {situacion === "apagada" ? (
            <p className="mt-1 text-xs text-neutro-500">
              No se muestra en el catálogo: no hay ninguna reserva, la retiraste tú.
            </p>
          ) : null}
        </div>

        {situacion === "reservada" ? (
          /*
           * Liberar va por la función. Se envía solo el identificador: el permiso lo
           * resuelve el servidor —y la función, dentro de la misma transacción—, no
           * un campo del formulario.
           */
          <form action={accionLiberar}>
            <input type="hidden" name="habitacionId" value={habitacion.id} />
            <BotonAccion
              etiqueta={etiqueta}
              ariaLabel={`Liberar la reserva de la habitación ${descripcion}`}
              tono="confirmar"
            />
          </form>
        ) : (
          /*
           * Encender y apagar sí son la columna: es exactamente lo que el anfitrión
           * decide, y ninguna de las dos choca con la restricción de la reserva
           * porque estas habitaciones no la tienen.
           */
          <form action={accionApagar}>
            <input type="hidden" name="habitacionId" value={habitacion.id} />
            <input type="hidden" name="disponible" value={situacion === "apagada" ? "1" : "0"} />
            <BotonAccion
              etiqueta={etiqueta}
              ariaLabel={
                situacion === "apagada"
                  ? `Volver a ofrecer la habitación ${descripcion}`
                  : `Retirar de la oferta la habitación ${descripcion}`
              }
              tono={situacion === "apagada" ? "confirmar" : "neutral"}
            />
          </form>
        )}
      </div>

      <MensajeAccion estado={estado} />
    </li>
  );
}

/** Retirar o volver a publicar el anuncio completo. */
function AccionesPublicacion({
  pensionId,
  slug,
  activa,
}: {
  /** Identificador interno: sigue siendo la clave para editar (`/publicar/<id>/editar`). */
  pensionId: string;
  /** Dirección pública del anuncio: es la que se muestra al abrirlo en el catálogo. */
  slug: string;
  activa: boolean;
}) {
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

        {/* Editar está siempre disponible: una publicación retirada también
            necesita corregirse antes de volver a publicarla. */}
        <Link
          href={`/publicar/${pensionId}/editar`}
          className="inline-flex h-11 items-center rounded-xl border border-primary-600 px-4 text-sm font-bold text-primary-700 transition hover:bg-primary-50"
        >
          Editar anuncio
        </Link>

        {/* El enlace al catálogo solo aparece si la publicación está activa: una
            publicación retirada no es accesible al público, así que enlazarla
            llevaría a un 404. */}
        {activa ? (
          <Link
            href={`/pensiones/${slug}`}
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
