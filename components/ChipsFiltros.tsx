"use client";

import {
  ETIQUETA_FILTRO,
  FILTROS_INICIALES,
  filtrosActivos,
  quitarFiltro,
  type ClaveFiltro,
  type FiltrosUI,
} from "@/lib/filtros";
import { formatearCOP } from "@/lib/formato";

interface Props {
  filtros: FiltrosUI;
  /** Máximo real del catálogo: es a donde vuelve el filtro de precio al quitarlo. */
  precioMaximoReal: number;
  onChange: (filtros: FiltrosUI) => void;
}

/**
 * Filtros activos, cada uno con su aspa para quitarlo.
 *
 * Esto es lo que faltaba en el móvil: el «Limpiar todos los filtros» existía, pero
 * solo se ofrecía cuando la búsqueda no devolvía nada. Con resultados en pantalla
 * no había forma de deshacer, y el estudiante quedaba encerrado en su propia
 * búsqueda. Ahora cada filtro se puede quitar por separado —que es lo que se
 * quiere casi siempre— y todos de una vez.
 *
 * Se muestra siempre que haya algún filtro, tenga resultados o no.
 */

/** Texto corto y con el valor real: el chip debe decir qué está filtrando. */
const TEXTO: Record<ClaveFiltro, (f: FiltrosUI) => string> = {
  precioMaximoCop: (f) => `Hasta ${formatearCOP(f.precioMaximoCop)}`,
  genero: (f) =>
    ({ todos: "Todos", mixto: "Mixto", femenino: "Femenino", masculino: "Masculino" })[f.genero],
  rangoDistancia: (f) =>
    ({ cualquiera: "Cualquier distancia", "<5": "< 5 min", "5-10": "5–10 min", "10-15": "10–15 min" })[
      f.rangoDistancia
    ],
  soloConAlimentacion: () => "Con alimentación",
  soloVerificadas: () => "Solo verificadas",
  soloFavoritas: () => "Mis favoritas",
};

export default function ChipsFiltros({ filtros, precioMaximoReal, onChange }: Props) {
  const activos = filtrosActivos(filtros, precioMaximoReal);
  if (activos.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <p className="text-sm font-semibold text-neutro-700">
        {activos.length === 1 ? "1 filtro aplicado" : `${activos.length} filtros aplicados`}
      </p>

      {activos.map((clave) => (
        <span
          key={clave}
          className="inline-flex items-center overflow-hidden rounded-full border border-primary-600 bg-primary-50"
        >
          <span className="pl-3 text-sm font-semibold text-primary-700">{TEXTO[clave](filtros)}</span>
          <button
            type="button"
            onClick={() => onChange(quitarFiltro(filtros, clave, precioMaximoReal))}
            aria-label={`Quitar filtro: ${ETIQUETA_FILTRO[clave]}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-primary-700 transition hover:bg-primary-100"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={() =>
          // El orden se conserva: no es un filtro, es cómo se mira la lista.
          onChange({ ...FILTROS_INICIALES, precioMaximoCop: precioMaximoReal, orden: filtros.orden })
        }
        className="inline-flex h-11 items-center rounded-full px-3 text-sm font-bold text-accent-700 underline underline-offset-2 transition hover:text-accent-800"
      >
        Quitar todos
      </button>
    </div>
  );
}
