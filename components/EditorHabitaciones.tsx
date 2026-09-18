"use client";

import type { GeneroHabitacion, TipoHabitacion } from "@/types";
import { formatearCOP } from "@/lib/formato";

export interface HabitacionForm {
  tipo: TipoHabitacion;
  genero: GeneroHabitacion;
  /** Precio como texto para el input; se convierte a número al enviar. */
  precio_mensual_cop: string;
  alimentacion_incluida: boolean;
  disponible: boolean;
}

const TIPOS: { valor: TipoHabitacion; etiqueta: string }[] = [
  { valor: "individual", etiqueta: "Individual" },
  { valor: "compartida", etiqueta: "Compartida" },
  { valor: "matrimonial", etiqueta: "Matrimonial" },
];

const GENEROS: { valor: GeneroHabitacion; etiqueta: string }[] = [
  { valor: "mixto", etiqueta: "Mixto (cualquiera)" },
  { valor: "femenino", etiqueta: "Solo mujeres" },
  { valor: "masculino", etiqueta: "Solo hombres" },
];

export const HABITACION_INICIAL: HabitacionForm = {
  tipo: "individual",
  genero: "mixto",
  precio_mensual_cop: "",
  alimentacion_incluida: false,
  disponible: true,
};

interface Props {
  habitaciones: HabitacionForm[];
  onChange: (habitaciones: HabitacionForm[]) => void;
  maximo?: number;
}

/**
 * Habitaciones del anuncio.
 *
 * Es obligatorio publicar al menos una: los estudiantes filtran por **tipo,
 * género y alimentación**, y esos datos viven en la habitación, no en la
 * pensión. Sin habitaciones, un anuncio desaparece en cuanto se usa un filtro.
 */
export default function EditorHabitaciones({ habitaciones, onChange, maximo = 20 }: Props) {
  const actualizar = (indice: number, cambios: Partial<HabitacionForm>) => {
    onChange(habitaciones.map((h, i) => (i === indice ? { ...h, ...cambios } : h)));
  };

  const agregar = () => {
    if (habitaciones.length >= maximo) return;
    // Se hereda el precio anterior para no reescribirlo si es similar.
    const anterior = habitaciones[habitaciones.length - 1];
    onChange([
      ...habitaciones,
      { ...HABITACION_INICIAL, precio_mensual_cop: anterior?.precio_mensual_cop ?? "" },
    ]);
  };

  const quitar = (indice: number) => onChange(habitaciones.filter((_, i) => i !== indice));

  return (
    <div className="mt-1 space-y-3">
      {habitaciones.map((habitacion, indice) => (
        <fieldset
          key={indice}
          className="rounded-2xl border border-neutro-200 bg-white p-4"
        >
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-neutro-500">
            Habitación {indice + 1}
            {habitaciones.length > 1 && (
              <button
                type="button"
                onClick={() => quitar(indice)}
                className="ml-3 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-confianza-danger transition hover:bg-confianza-danger/10"
              >
                Quitar
              </button>
            )}
          </legend>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutro-700">Tipo</span>
              <select
                value={habitacion.tipo}
                onChange={(evento) =>
                  actualizar(indice, { tipo: evento.target.value as TipoHabitacion })
                }
                className="h-11 w-full rounded-lg border border-neutro-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {TIPOS.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutro-700">Género</span>
              <select
                value={habitacion.genero}
                onChange={(evento) =>
                  actualizar(indice, { genero: evento.target.value as GeneroHabitacion })
                }
                className="h-11 w-full rounded-lg border border-neutro-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {GENEROS.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutro-700">
                Precio mensual (COP)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1000}
                step={1000}
                required
                value={habitacion.precio_mensual_cop}
                onChange={(evento) =>
                  actualizar(indice, { precio_mensual_cop: evento.target.value })
                }
                placeholder="450000"
                className="h-11 w-full rounded-lg border border-neutro-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-neutro-700">
              <input
                type="checkbox"
                checked={habitacion.alimentacion_incluida}
                onChange={(evento) =>
                  actualizar(indice, { alimentacion_incluida: evento.target.checked })
                }
                className="h-5 w-5 rounded border-neutro-300 text-primary-600 focus:ring-primary-500"
              />
              🍽️ Incluye alimentación
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-neutro-700">
              <input
                type="checkbox"
                checked={habitacion.disponible}
                onChange={(evento) => actualizar(indice, { disponible: evento.target.checked })}
                className="h-5 w-5 rounded border-neutro-300 text-primary-600 focus:ring-primary-500"
              />
              Disponible ahora
            </label>

            {Number(habitacion.precio_mensual_cop) > 0 && (
              <span className="text-sm font-semibold text-accent-700">
                {formatearCOP(Number(habitacion.precio_mensual_cop))}/mes
              </span>
            )}
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={agregar}
        disabled={habitaciones.length >= maximo}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary-600 px-4 text-sm font-bold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-neutro-300 disabled:text-neutro-400"
      >
        + Agregar otra habitación
      </button>
    </div>
  );
}
