"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { actualizarPension } from "@/app/actions/pensiones";
import type { EstadoFormulario } from "@/app/actions/pensiones";
import type { PensionConHabitaciones } from "@/types";
import { formatearCOP } from "@/lib/formato";
import { IMAGEN_RESPALDO, imagenesDe } from "@/lib/pension";
import { MAXIMO_FOTOS } from "@/lib/imagenes";
import SubidorFotos from "@/components/SubidorFotos";
import EditorHabitaciones, {
  HABITACION_INICIAL,
  type HabitacionForm,
} from "@/components/EditorHabitaciones";
import {
  BARRIOS,
  NORMAS,
  SERVICIOS,
  claseEtiqueta,
  claseInput,
  conOpcionesActuales,
} from "@/lib/formulario-pension";
import CampoWhatsApp from "@/components/CampoWhatsApp";

const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensaje: null };

/** Iguales a los límites de la base: la interfaz los comunica antes de fallar. */
const TITULO_MAX = 120;
const DESCRIPCION_MAX = 2000;

/**
 * Edición de un anuncio ya publicado.
 *
 * Reutiliza los mismos componentes del alta (`EditorHabitaciones`,
 * `SubidorFotos`) para que la experiencia y las reglas sean idénticas. Las
 * habitaciones viajan con su `id`, que es lo que permite actualizarlas en el
 * servidor en lugar de recrearlas y perder su disponibilidad.
 */
export default function FormularioEditarPension({ pension }: { pension: PensionConHabitaciones }) {
  const [estado, accion] = useFormState(actualizarPension, ESTADO_INICIAL);

  /**
   * Fotos actuales. Se descarta la de respaldo: es un marcador de posición del
   * catálogo, no una foto del anfitrión, y guardarla la convertiría en suya.
   */
  const [imagenes, setImagenes] = useState<string[]>(
    imagenesDe(pension).filter((url) => url !== IMAGEN_RESPALDO)
  );

  const [habitaciones, setHabitaciones] = useState<HabitacionForm[]>(
    pension.habitaciones.length > 0
      ? pension.habitaciones.map((habitacion) => ({
          id: habitacion.id,
          tipo: habitacion.tipo,
          genero: habitacion.genero,
          precio_mensual_cop: String(habitacion.precio_mensual_cop),
          alimentacion_incluida: habitacion.alimentacion_incluida,
          disponible: habitacion.disponible,
        }))
      : [{ ...HABITACION_INICIAL, precio_mensual_cop: String(pension.precioMensual || "") }]
  );

  const [largoTitulo, setLargoTitulo] = useState(pension.titulo.length);
  const [largoDescripcion, setLargoDescripcion] = useState(pension.descripcion.length);

  // El anuncio pudo publicarse con un barrio, un servicio o una norma que hoy no
  // esté en la lista: se añaden para no perderlos al guardar.
  const opcionesBarrios = conOpcionesActuales(BARRIOS, [pension.barrio]);
  const opcionesServicios = conOpcionesActuales(SERVICIOS, pension.servicios);
  const opcionesNormas = conOpcionesActuales(NORMAS, pension.normas);

  /** Mismo cálculo que la base: la habitación disponible más barata. */
  const preciosDisponibles = habitaciones
    .filter((habitacion) => habitacion.disponible)
    .map((habitacion) => Number(habitacion.precio_mensual_cop))
    .filter((precio) => Number.isFinite(precio) && precio > 0);
  const precioDesde = preciosDisponibles.length > 0 ? Math.min(...preciosDisponibles) : 0;

  return (
    <form action={accion} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200">
      <input type="hidden" name="pensionId" value={pension.id} />

      <h1 className="font-display text-xl font-extrabold text-neutro-900">
        Editar «{pension.titulo}»
      </h1>
      <p className="mt-1 text-sm text-neutro-600">
        Los cambios se ven en el catálogo y en la ficha en cuanto guardas.
      </p>

      {!pension.activa && (
        <p className="mt-4 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-3 py-2 text-sm font-semibold text-neutro-700">
          Este anuncio está <strong>retirado</strong>: no aparece en el catálogo. Puedes editarlo
          igualmente y volver a publicarlo desde tu panel.
        </p>
      )}

      {estado.mensaje && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-3 py-2 text-sm font-semibold text-confianza-danger"
        >
          {estado.mensaje}
        </p>
      )}

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="titulo" className={claseEtiqueta}>
            Título del alojamiento
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            required
            minLength={6}
            maxLength={TITULO_MAX}
            defaultValue={pension.titulo}
            onChange={(evento) => setLargoTitulo(evento.target.value.length)}
            className={claseInput}
            placeholder="Ej.: Habitación amoblada cerca a la Universidad"
          />
          <p className="mt-1 text-xs text-neutro-500">
            {largoTitulo}/{TITULO_MAX} caracteres
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="direccion" className={claseEtiqueta}>
              Dirección
            </label>
            <input
              id="direccion"
              name="direccion"
              type="text"
              required
              minLength={5}
              defaultValue={pension.direccion}
              className={claseInput}
              placeholder="Calle 30 # 12-45"
            />
          </div>
          <div>
            <label htmlFor="barrio" className={claseEtiqueta}>
              Barrio
            </label>
            <select id="barrio" name="barrio" className={claseInput} defaultValue={pension.barrio}>
              {opcionesBarrios.map((barrio) => (
                <option key={barrio} value={barrio}>
                  {barrio}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="max-w-xs">
          <label htmlFor="distancia" className={claseEtiqueta}>
            Minutos a pie de Unimagdalena
          </label>
          <input
            id="distancia"
            name="distancia"
            type="number"
            min={0}
            max={60}
            required
            inputMode="numeric"
            defaultValue={pension.distancia_a_pie_minutos}
            className={claseInput}
          />
          <p className="mt-1 text-xs text-neutro-500">
            Los estudiantes filtran por distancia: este dato decide si apareces.
          </p>
        </div>

        <CampoWhatsApp
          valorInicial={pension.whatsapp}
          avisaSiFalta
          conAutorizacionPrevia={Boolean(pension.autorizacion_contacto_en)}
        />

        <div>
          <span className={claseEtiqueta}>Habitaciones que ofreces</span>
          <p className="mt-0.5 text-xs text-neutro-500">
            El precio que verá el estudiante en la tarjeta es el de la habitación disponible más
            barata. Marca «Disponible ahora» solo en las que puedas alquilar hoy.
          </p>

          <EditorHabitaciones habitaciones={habitaciones} onChange={setHabitaciones} />

          <input type="hidden" name="habitaciones" value={JSON.stringify(habitaciones)} />

          {precioDesde > 0 && (
            <p
              aria-live="polite"
              className="mt-3 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-800"
            >
              Tu anuncio aparecerá en el catálogo desde {formatearCOP(precioDesde)} /mes.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="descripcion" className={claseEtiqueta}>
            Descripción detallada
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={6}
            required
            minLength={30}
            maxLength={DESCRIPCION_MAX}
            defaultValue={pension.descripcion}
            onChange={(evento) => setLargoDescripcion(evento.target.value.length)}
            className={claseInput}
            placeholder="Describe el ambiente, qué incluye el precio y a quién está dirigido."
          />
          <p className="mt-1 text-xs text-neutro-500">
            {largoDescripcion}/{DESCRIPCION_MAX} caracteres
          </p>
        </div>

        <fieldset>
          <legend className={claseEtiqueta}>Servicios incluidos</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opcionesServicios.map((servicio) => (
              <label
                key={servicio}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-neutro-200 px-3 text-sm text-neutro-700"
              >
                <input
                  type="checkbox"
                  name="servicios"
                  value={servicio}
                  defaultChecked={pension.servicios.includes(servicio)}
                  className="h-4 w-4 accent-primary-600"
                />
                {servicio}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={claseEtiqueta}>Normas de la casa</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opcionesNormas.map((norma) => (
              <label
                key={norma}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-neutro-200 px-3 text-sm text-neutro-700"
              >
                <input
                  type="checkbox"
                  name="normas"
                  value={norma}
                  defaultChecked={pension.normas.includes(norma)}
                  className="h-4 w-4 accent-primary-600"
                />
                {norma}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <span className={claseEtiqueta}>Fotos de la pensión</span>
          <p className="mt-0.5 text-xs text-neutro-500">
            Puedes añadir nuevas y quitar las que ya no quieras mostrar (hasta {MAXIMO_FOTOS}). La
            primera de la lista es la principal.
          </p>
          <SubidorFotos valor={imagenes} onChange={setImagenes} />

          <input type="hidden" name="imagenes" value={imagenes.join("\n")} />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <BotonGuardar />
        <Link
          href="/publicar"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-neutro-300 px-5 text-[15px] font-bold text-neutro-700 transition hover:bg-neutro-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function BotonGuardar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 flex-1 rounded-xl bg-accent-700 px-4 text-[15px] font-bold text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}
