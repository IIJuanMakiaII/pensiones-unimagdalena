"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { Habitacion, PensionConHabitaciones } from "@/types";
import {
  borrarPensionMaestro,
  cambiarEstadoPublicacionMaestro,
  liberarHabitacionReservadaMaestro,
  marcarHabitacionReservadaMaestro,
  sellarVerificacionMaestro,
} from "@/app/actions/maestro";
import { ESTADO_RESERVA_INICIAL, type EstadoReserva } from "@/lib/reserva";
import { PALABRA_DE_BORRADO } from "@/lib/borrado";
import { formatearFechaVerificacion } from "@/lib/sello";
import type { EstadoFormulario } from "@/lib/pension-escritura";
import type { ContactoDePanel } from "@/lib/contacto-panel";
import ContactoAnfitrionPrivado from "@/components/ContactoAnfitrionPrivado";
import CorregirWhatsappAnfitrion from "@/components/CorregirWhatsappAnfitrion";
import {
  etiquetaGenero,
  etiquetaTipo,
  formatearCOP,
  formatearFechaReserva,
} from "@/lib/formato";

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

/**
 * La tarjeta de administración de una publicación.
 *
 * `contacto` llega **ya resuelto** desde el servidor (`app/maestro/page.tsx`), y no
 * se calcula aquí: el enlace de WhatsApp se construye con el módulo que habla con
 * la tabla privada, que es de servidor. Ver `lib/contacto-panel.ts`.
 */
export default function PanelMaestro({
  pension,
  contacto,
}: {
  pension: PensionConHabitaciones;
  contacto: ContactoDePanel;
}) {
  const habitaciones = pension.habitaciones ?? [];
  const libres = habitaciones.filter((habitacion) => habitacion.disponible);
  const preciosLibres = libres.map((habitacion) => habitacion.precio_mensual_cop);
  const precioDesdeLibre = preciosLibres.length > 0 ? Math.min(...preciosLibres) : 0;

  return (
    <article className="rounded-2xl bg-white p-4 ring-1 ring-neutro-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-neutro-800">{pension.titulo}</h3>
          {/* El código visible (tarea #88), entre el título y la línea de barrio: es
              el asa con la que se nombra un anuncio por teléfono. Se imprime **tal
              como lo entregó la base**, sin rellenarlo ni recalcularlo, y mientras no
              haya ninguno —la migración de la columna la aplica el propietario a
              mano— la línea simplemente no se dibuja: mejor nada que un código
              inventado, que podría repetirse o cambiar de un listado a otro. */}
          {pension.codigo_visible ? (
            <p className="font-display text-sm font-bold tabular-nums text-neutro-800">
              {pension.codigo_visible}
            </p>
          ) : null}
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
          {/* El estado del sello, a la vista junto a «Publicada/Retirada»: quien
              administra tiene que poder ver de un vistazo qué anuncios llevan la
              insignia pública sin abrir cada uno. Reutiliza el par de colores de
              «Publicada», que ya está verificado para contraste. */}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              pension.verificado
                ? "bg-primary-50 text-primary-800 ring-1 ring-primary-100"
                : "bg-neutro-100 text-neutro-600 ring-1 ring-neutro-200"
            }`}
          >
            {pension.verificado ? "Verificado" : "Sin verificar"}
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
            <FilaHabitacionMaestro key={habitacion.id} habitacion={habitacion} />
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-neutro-200 pt-4">
        <AccionesMaestro pension={pension} contacto={contacto} />
      </div>
    </article>
  );
}

/**
 * Una habitación con su acción de reserva, válida para cualquier anuncio.
 *
 * DOS ACCIONES, NO UN INTERRUPTOR
 * ------------------------------
 * Antes había un solo botón que enviaba `disponible = true/false` a un `update`
 * del cliente. Ahora el estado «reservada» no es un booleano suelto: es una marca
 * con fecha y autor, y solo la base la escribe (`marcar_habitacion_reservada` y
 * `liberar_habitacion_reservada`, oleada 17). Por eso hay dos acciones explícitas
 * y el botón que se ve decide cuál se envía: no hay un despachador que reciba de
 * vuelta el nombre de la función desde el formulario, que sería dejar al navegador
 * elegir qué se ejecuta.
 *
 * Las dos se declaran siempre —una por rama— porque los hooks no se pueden llamar
 * dentro de un `if`. Se renderiza la que corresponde al estado de la habitación.
 *
 * LA FECHA
 * --------
 * `reservada_en` no tiene `SELECT` para ningún rol de cliente: `anon` y
 * `authenticated` reciben `42501` (medido al aplicar la oleada 17). La única fecha
 * de reserva que este panel puede enseñar es la que devolvió la función en el
 * momento de marcar, y por eso se queda en el estado del formulario y no se vuelve
 * a pedir. Al recargar la página no hay fecha: no es un descuido y no se rellena
 * con nada. Recuperarla pide una función de lectura `security definer` (oleada 18).
 */
function FilaHabitacionMaestro({ habitacion }: { habitacion: Habitacion }) {
  const [estadoReservar, accionReservar] = useFormState(
    marcarHabitacionReservadaMaestro,
    ESTADO_RESERVA_INICIAL
  );
  const [estadoLiberar, accionLiberar] = useFormState(
    liberarHabitacionReservadaMaestro,
    ESTADO_RESERVA_INICIAL
  );

  const descripcion = `${etiquetaTipo(habitacion.tipo)} · ${etiquetaGenero(habitacion.genero)}`;
  const reservada = !habitacion.disponible;

  const estado: EstadoReserva = reservada ? estadoLiberar : estadoReservar;
  const accion = reservada ? accionLiberar : accionReservar;

  // Solo la fecha de la reserva que se acaba de marcar. La de una reserva anterior
  // no existe para el cliente, así que no se inventa ni se deduce de otro campo.
  const fechaDeEstaReserva = formatearFechaReserva(estadoReservar.reservadaEn);

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
              {habitacion.disponible ? "Libre" : "Reservada"}
            </span>
          </p>
          <p className="precio mt-0.5 text-xs font-semibold text-neutro-500">
            {formatearCOP(habitacion.precio_mensual_cop)} /mes
            {habitacion.alimentacion_incluida ? " · con alimentación" : ""}
          </p>
          {reservada && fechaDeEstaReserva ? (
            <p className="mt-1 text-xs font-semibold text-neutro-600">
              Reservada el {fechaDeEstaReserva}.
            </p>
          ) : null}
        </div>

        <form action={accion}>
          <input type="hidden" name="habitacionId" value={habitacion.id} />
          <BotonAccion
            etiqueta={reservada ? "Liberar" : "Marcar reservada"}
            ariaLabel={
              reservada
                ? `Liberar la reserva de la habitación ${descripcion}`
                : `Marcar como reservada la habitación ${descripcion}`
            }
            tono={reservada ? "neutral" : "confirmar"}
          />
        </form>
      </div>

      <MensajeAccion estado={estado} />
    </li>
  );
}

/** Retirar, reactivar, editar y borrar el anuncio completo. */
function AccionesMaestro({
  pension,
  contacto,
}: {
  pension: PensionConHabitaciones;
  contacto: ContactoDePanel;
}) {
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

      {/*
        La corrección del número solo se ofrece cuando hay un número que corregir
        (tarea #80). El caso que el propietario describió es «el anfitrión me dice
        que cambió de número», y eso exige que antes hubiera uno. Si el anfitrión
        no ha dejado ninguno, el sitio para ponerlo es su propio formulario, no el
        panel del maestro: aquí nadie tendría que estar inventando un teléfono.

        Solo se pasa `pensionId`. El destinatario del cambio —el anfitrión— lo
        resuelve la acción en el servidor a partir del anuncio, y por eso no hay
        ningún campo que diga a quién se le escribe.
      */}
      <ContactoAnfitrionPrivado
        contacto={contacto}
        titulo={pension.titulo}
        accion={
          contacto.estado === "ok" ? (
            <CorregirWhatsappAnfitrion
              pensionId={pension.id}
              whatsappActual={contacto.whatsapp}
            />
          ) : null
        }
      />

      <ControlSello pension={pension} />

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
 * La tarjeta del WhatsApp privado se movió a `components/ContactoAnfitrionPrivado.tsx`
 * (tarea #79): la usan este panel y el formulario de edición del maestro, y tiene que
 * ser **una sola**, porque la frase de privacidad no puede divergir entre dos
 * pantallas que hablan del mismo dato. El razonamiento de los cuatro estados vive
 * allí.
 */

/**
 * El sello de verificación: su estado y su llave.
 *
 * QUÉ ES ESTE BOTÓN, EN UNA FRASE
 * -------------------------------
 * Es la manija que le faltaba a la cerradura. La base ya tenía montado todo lo
 * demás —`verificado` fuera de las columnas que `authenticated` puede escribir,
 * y la función `maestro_actualizar_campos_pension` con `es_maestro()` dentro y
 * `verificado` en su lista blanca—, y la portada ya afirmaba que «lo otorga el
 * equipo de Nido desde el panel». Hasta hoy esa frase describía una capacidad
 * que existía en la base pero no en la interfaz.
 *
 * POR QUÉ NO LLEVA CONFIRMACIÓN DE TEXTO, AL CONTRARIO QUE EL BORRADO
 * ------------------------------------------------------------------
 * Porque es reversible con el mismo clic. El borrado exige escribir una palabra
 * porque no tiene vuelta atrás; esto es un interruptor, y retirarlo deja el
 * anuncio como estaba. Poner la misma ceremonia en las dos cosas enseñaría a
 * escribir la palabra sin leerla, que es justo lo contrario de lo que se busca.
 *
 * LO QUE ESTE COMPONENTE NO DECIDE
 * -------------------------------
 * Si quien mira puede pulsar. Eso lo resuelven el servidor —`exigirMaestro()` en
 * la acción— y la base, dentro de la propia función. Aquí no se recibe el rol
 * como prop: si se recibiera, parecería que el navegador tiene voz en la
 * decisión, y los componentes de este panel no toman decisiones de permiso.
 */
function ControlSello({ pension }: { pension: PensionConHabitaciones }) {
  const [estado, accion] = useFormState(sellarVerificacionMaestro, ESTADO_INICIAL);
  const fecha = formatearFechaVerificacion(pension.verificado_en);
  const siguiente = !pension.verificado;

  return (
    <div className="mt-4 rounded-xl border border-neutro-200 bg-neutro-50 p-4">
      <p className="text-sm font-bold text-neutro-800">Sello «Verificado por Nido ✓»</p>

      <p className="mt-1 text-sm leading-relaxed text-neutro-600">
        {pension.verificado
          ? fecha
            ? `Concedido y fechado el ${fecha}. El catálogo y la ficha muestran la insignia.`
            : "Concedido, sin constancia de cuándo: el anuncio ya estaba verificado antes de que existiera la fecha."
          : "Sin conceder. El anuncio aparece en el catálogo sin la insignia."}
      </p>

      <p className="mt-1 text-xs leading-relaxed text-neutro-500">
        La fecha la pone la base en el momento en que se concede, y se borra si el sello se
        retira. No se puede escribir a mano.
      </p>

      <form action={accion} className="mt-3">
        <input type="hidden" name="pensionId" value={pension.id} />
        <input type="hidden" name="verificado" value={siguiente ? "1" : "0"} />
        <BotonAccion
          etiqueta={siguiente ? "Activar sello" : "Retirar sello"}
          ariaLabel={
            siguiente
              ? `Conceder el sello «Verificado por Nido» a «${pension.titulo}»`
              : `Retirar el sello «Verificado por Nido» a «${pension.titulo}»`
          }
          tono={siguiente ? "confirmar" : "neutral"}
        />
      </form>

      <MensajeAccion estado={estado} />
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
