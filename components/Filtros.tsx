"use client";

import type { GeneroHabitacion, RangoDistancia } from "@/types";
import type { FiltrosUI } from "@/lib/filtros";
import { PASO_PRECIO } from "@/lib/filtros";
import { formatearCOP } from "@/lib/formato";

interface Props {
  filtros: FiltrosUI;
  onChange: (filtros: FiltrosUI) => void;
  /** Rango de precios real del catálogo cargado (se calcula en el cliente). */
  limitesPrecio: { min: number; max: number };
  /** Cuántas pensiones tiene guardadas el estudiante (localStorage). */
  totalFavoritos?: number;
}

const OPCIONES_GENERO: { valor: FiltrosUI["genero"]; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "mixto", etiqueta: "Mixto" },
  { valor: "femenino", etiqueta: "Femenino" },
  { valor: "masculino", etiqueta: "Masculino" },
];

const OPCIONES_DISTANCIA: { valor: RangoDistancia; etiqueta: string }[] = [
  { valor: "cualquiera", etiqueta: "Cualquiera" },
  { valor: "<5", etiqueta: "< 5 min" },
  { valor: "5-10", etiqueta: "5–10 min" },
  { valor: "10-15", etiqueta: "10–15 min" },
];

/** Barra de filtros sticky: precio (slider), género, distancia y alimentación (§4.4). */
export default function Filtros({ filtros, onChange, limitesPrecio, totalFavoritos = 0 }: Props) {
  const actualizar = (parcial: Partial<FiltrosUI>) =>
    onChange({ ...filtros, ...parcial });

  return (
    <div className="sticky top-0 z-30 border-b border-neutro-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:px-6">
        {/* Precio */}
        <div className="flex items-center gap-3">
          <label htmlFor="filtro-precio" className="shrink-0 text-sm font-semibold text-neutro-700">
            Precio
          </label>
          <input
            id="filtro-precio"
            type="range"
            min={limitesPrecio.min}
            max={limitesPrecio.max}
            step={PASO_PRECIO}
            value={filtros.precioMaximoCop}
            onChange={(e) => actualizar({ precioMaximoCop: Number(e.target.value) })}
            className="h-2 w-full accent-accent-500"
            aria-label="Precio máximo mensual en pesos colombianos"
          />
          <output className="precio shrink-0 rounded-lg bg-accent-700 px-2.5 py-1 text-sm font-extrabold text-white" htmlFor="filtro-precio">
            Hasta {formatearCOP(filtros.precioMaximoCop)}
          </output>
        </div>

        {/* Género */}
        <div role="group" aria-label="Filtrar por género" className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-sm font-semibold text-neutro-700">Género</span>
          {OPCIONES_GENERO.map((op) => {
            const activo = filtros.genero === op.valor;
            return (
              <button
                key={op.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => actualizar({ genero: op.valor as FiltrosUI["genero"] })}
                className={`h-11 rounded-full px-4 text-sm font-semibold transition ${
                  activo
                    ? "bg-accent-700 text-white shadow-sm"
                    : "border border-neutro-300 bg-white text-neutro-700 hover:border-accent-400"
                }`}
              >
                {op.etiqueta}
              </button>
            );
          })}
        </div>

        {/* Distancia */}
        <div role="group" aria-label="Filtrar por distancia caminando" className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-sm font-semibold text-neutro-700">Distancia</span>
          {OPCIONES_DISTANCIA.map((op) => {
            const activo = filtros.rangoDistancia === op.valor;
            return (
              <button
                key={op.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => actualizar({ rangoDistancia: op.valor })}
                className={`h-11 rounded-full px-4 text-sm font-semibold transition ${
                  activo
                    ? "bg-accent-700 text-white shadow-sm"
                    : "border border-neutro-300 bg-white text-neutro-700 hover:border-accent-400"
                }`}
              >
                {op.etiqueta}
              </button>
            );
          })}
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-sm font-semibold text-neutro-700">Extras</span>
          <button
            type="button"
            aria-pressed={filtros.soloConAlimentacion}
            onClick={() => actualizar({ soloConAlimentacion: !filtros.soloConAlimentacion })}
            className={`h-11 rounded-full px-4 text-sm font-semibold transition ${
              filtros.soloConAlimentacion
                ? "bg-accent-700 text-white shadow-sm"
                : "border border-neutro-300 bg-white text-neutro-700 hover:border-accent-400"
            }`}
          >
            🍽️ Con alimentación
          </button>
          <button
            type="button"
            aria-pressed={filtros.soloVerificadas}
            onClick={() => actualizar({ soloVerificadas: !filtros.soloVerificadas })}
            className={`h-11 rounded-full px-4 text-sm font-semibold transition ${
              filtros.soloVerificadas
                ? "bg-primary-600 text-white shadow-sm"
                : "border border-neutro-300 bg-white text-neutro-700 hover:border-primary-400"
            }`}
          >
            ✓ Solo verificadas
          </button>
          <button
            type="button"
            aria-pressed={filtros.soloFavoritas}
            onClick={() => actualizar({ soloFavoritas: !filtros.soloFavoritas })}
            className={`h-11 rounded-full px-4 text-sm font-semibold transition ${
              filtros.soloFavoritas
                ? "bg-accent-700 text-white shadow-sm"
                : "border border-neutro-300 bg-white text-neutro-700 hover:border-accent-400"
            }`}
          >
            ♥ Mis favoritas{totalFavoritos > 0 ? ` (${totalFavoritos})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
