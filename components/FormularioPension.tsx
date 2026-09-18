"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearPension } from "@/app/actions/pensiones";
import type { EstadoFormulario } from "@/app/actions/pensiones";
import { formatearCOP } from "@/lib/formato";
import SubidorFotos from "@/components/SubidorFotos";
import EditorHabitaciones, {
  HABITACION_INICIAL,
  type HabitacionForm,
} from "@/components/EditorHabitaciones";

/**
 * Estado inicial del formulario. Vive aquí (no en el módulo de acciones) porque
 * un archivo "use server" solo puede exportar funciones asíncronas: al
 * importarlo desde allí llegaba al cliente como referencia de servidor.
 */
const ESTADO_INICIAL: EstadoFormulario = { ok: false, mensaje: null };

/** Servicios ofrecidos con más frecuencia en Santa Marta. */
const SERVICIOS = [
  "WiFi de alta velocidad",
  "Aire acondicionado",
  "Lavandería",
  "Cocina compartida",
  "Agua y energía incluidas",
  "3 comidas al día",
  "Zona de estudio",
  "Parqueadero",
];

const NORMAS = [
  "No fumadores",
  "Silencio después de las 10 p. m.",
  "Visitas hasta las 8 p. m.",
  "Entrada libre 24 h",
  "Cocina compartida con horario",
  "Respetar zonas comunes",
];

const BARRIOS = [
  "Mamatoco",
  "El Pando",
  "Zaragoza",
  "Gaira",
  "San Fernando",
  "Los Troncos",
  "Centro",
  "Otro",
];

const claseInput =
  "mt-1 w-full rounded-xl border border-neutro-300 bg-neutro-50 px-3 py-3 text-neutro-900 outline-none transition focus:border-primary-600 focus:bg-white";
const claseEtiqueta = "block text-sm font-semibold text-neutro-700";

/** Formulario de publicación de una pensión (Server Action + validación). */
export default function FormularioPension() {
  const [estado, accion] = useFormState(crearPension, ESTADO_INICIAL);
  /** URLs de las fotos: las subidas desde el dispositivo y los enlaces pegados. */
  const [imagenes, setImagenes] = useState<string[]>([]);

  /**
   * Habitaciones del anuncio. Al menos una es obligatoria: el tipo, el género y
   * la alimentación viven en la habitación, no en la pensión, así que un anuncio
   * sin habitaciones desaparece en cuanto el estudiante usa un filtro.
   */
  const [habitaciones, setHabitaciones] = useState<HabitacionForm[]>([{ ...HABITACION_INICIAL }]);

  /**
   * Precio que verá el estudiante en la tarjeta ("desde $X"): la habitación
   * disponible más barata. Es el mismo cálculo que hace la base de datos, así
   * que lo que se ve aquí es lo que quedará publicado.
   */
  const preciosDisponibles = habitaciones
    .filter((habitacion) => habitacion.disponible)
    .map((habitacion) => Number(habitacion.precio_mensual_cop))
    .filter((precio) => Number.isFinite(precio) && precio > 0);
  const precioDesde = preciosDisponibles.length > 0 ? Math.min(...preciosDisponibles) : 0;

  return (
    <form action={accion} className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-neutro-200">
      <h2 className="font-display text-xl font-extrabold text-neutro-900">Publicar una pensión</h2>
      <p className="mt-1 text-sm text-neutro-600">
        Completa los datos y aparecerá en el catálogo al instante.
      </p>

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
            className={claseInput}
            placeholder="Ej.: Habitación amoblada cerca a la Universidad"
          />
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
              className={claseInput}
              placeholder="Calle 30 # 12-45"
            />
          </div>
          <div>
            <label htmlFor="barrio" className={claseEtiqueta}>
              Barrio
            </label>
            <select id="barrio" name="barrio" className={claseInput} defaultValue="Mamatoco">
              {BARRIOS.map((barrio) => (
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
            defaultValue={10}
            inputMode="numeric"
            className={claseInput}
          />
          <p className="mt-1 text-xs text-neutro-500">
            Los estudiantes filtran por distancia: este dato decide si apareces.
          </p>
        </div>

        <div>
          <span className={claseEtiqueta}>Habitaciones que ofreces</span>
          <p className="mt-0.5 text-xs text-neutro-500">
            Publica cada habitación con su tipo, género y precio real. El precio que verá el
            estudiante en la tarjeta será el de la habitación disponible más barata.
          </p>

          <EditorHabitaciones habitaciones={habitaciones} onChange={setHabitaciones} />

          {/* Las habitaciones viajan al servidor en este campo oculto. */}
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
            rows={4}
            required
            minLength={30}
            className={claseInput}
            placeholder="Describe el ambiente, qué incluye el precio y a quién está dirigido, para que se entienda sin ver las fotos."
          />
        </div>

        <fieldset>
          <legend className={claseEtiqueta}>Servicios incluidos</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICIOS.map((servicio) => (
              <label
                key={servicio}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-neutro-200 px-3 text-sm text-neutro-700"
              >
                <input type="checkbox" name="servicios" value={servicio} className="h-4 w-4 accent-primary-600" />
                {servicio}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={claseEtiqueta}>Normas de la casa</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {NORMAS.map((norma) => (
              <label
                key={norma}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-neutro-200 px-3 text-sm text-neutro-700"
              >
                <input type="checkbox" name="normas" value={norma} className="h-4 w-4 accent-primary-600" />
                {norma}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <span className={claseEtiqueta}>Fotos de la pensión</span>
          <SubidorFotos valor={imagenes} onChange={setImagenes} />

          {/* Las URLs finales viajan al servidor en este campo oculto. */}
          <input type="hidden" name="imagenes" value={imagenes.join("\n")} />
        </div>
      </div>

      <BotonPublicar />
    </form>
  );
}

function BotonPublicar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 h-12 w-full rounded-xl bg-accent-700 px-4 text-[15px] font-bold text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Publicando…" : "Publicar pensión"}
    </button>
  );
}
