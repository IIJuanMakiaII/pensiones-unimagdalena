"use client";

import { useRef, useState } from "react";
import type { GeneroHabitacion, RangoDistancia } from "@/types";
import type { FiltrosUI } from "@/lib/filtros";
import {
  ETIQUETA_DISTANCIA,
  FILTROS_INICIALES,
  PASO_PRECIO,
  TRAMOS_DISTANCIA,
  filtrosActivos,
} from "@/lib/filtros";
import { formatearCOP } from "@/lib/formato";

interface Props {
  filtros: FiltrosUI;
  onChange: (filtros: FiltrosUI) => void;
  /** Rango de precios real del catálogo cargado (se calcula en el cliente). */
  limitesPrecio: { min: number; max: number };
  /** Cuántas pensiones tiene guardadas el estudiante (localStorage). */
  totalFavoritos?: number;
  /** Cuántas pensiones quedan con los filtros puestos (para el cierre del panel). */
  resultados: number;
}

const OPCIONES_GENERO: { valor: FiltrosUI["genero"]; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "mixto", etiqueta: "Mixto" },
  { valor: "femenino", etiqueta: "Femenino" },
  { valor: "masculino", etiqueta: "Masculino" },
];

/**
 * Opciones del filtro de distancia: primero la ausencia de filtro y después los
 * cuatro tramos.
 *
 * Se construyen desde `lib/filtros.ts` en vez de escribirse aquí. Antes el panel y
 * el motor guardaban cada uno su lista, y el panel ofrecía tres tramos mientras el
 * catálogo admitía anuncios hasta 60 minutos: lo que no cabía en ninguno de los
 * tres quedaba fuera de la búsqueda en cuanto se elegía distancia. Con una sola
 * lista, añadir o mover un tramo no puede dejar al panel desinformado.
 */
const OPCIONES_DISTANCIA: { valor: RangoDistancia; etiqueta: string }[] = [
  { valor: "cualquiera", etiqueta: ETIQUETA_DISTANCIA.cualquiera },
  ...TRAMOS_DISTANCIA.map((valor) => ({ valor, etiqueta: ETIQUETA_DISTANCIA[valor] })),
];

/**
 * Filtros del catálogo.
 *
 * En escritorio son los cuatro controles desplegados, como siempre. En móvil la
 * barra se recoge en una sola fila de 60 px —medido a 375 px: 8 % del alto— y los
 * controles se abren a petición. Antes iban siempre desplegados y, como la barra
 * es `sticky`, se quedaban fijos comiéndose media pantalla mientras el catálogo
 * pasaba por debajo: el problema que reportó el fundador.
 */
export default function Filtros({
  filtros,
  onChange,
  limitesPrecio,
  totalFavoritos = 0,
  resultados,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);

  const actualizar = (parcial: Partial<FiltrosUI>) => onChange({ ...filtros, ...parcial });

  const activos = filtrosActivos(filtros, limitesPrecio.max);

  /** Quitar todos conserva el orden elegido: no es un filtro, es cómo se mira la lista. */
  const quitarTodos = () =>
    onChange({ ...FILTROS_INICIALES, precioMaximoCop: limitesPrecio.max, orden: filtros.orden });

  /** Cerrar y devolver el foco al botón: si no, en el móvil el foco se queda perdido. */
  const cerrar = () => {
    setAbierto(false);
    botonRef.current?.focus();
  };

  return (
    <div className="sticky top-0 z-30 border-b border-neutro-200 bg-white/95 backdrop-blur">
      {/* Fila compacta: es todo lo que la barra ocupa mientras se recorre el catálogo.
          Solo existe en móvil y tablet; en escritorio la barra queda como estaba. */}
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 md:px-6 lg:hidden">
        <button
          ref={botonRef}
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="panel-filtros"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-neutro-200 bg-white px-4 text-sm font-semibold text-neutro-800 transition hover:border-neutro-800"
        >
          <IconoFiltro />
          {activos.length > 0 ? `Filtros (${activos.length})` : "Filtros"}
          <IconoFlecha abierto={abierto} />
        </button>

        {activos.length > 0 && (
          <button
            type="button"
            onClick={quitarTodos}
            className="inline-flex h-11 shrink-0 items-center rounded-xl px-3 text-sm font-bold text-accent-700 underline underline-offset-2 transition hover:text-accent-800"
          >
            Quitar
          </button>
        )}
      </div>

      <div id="panel-filtros" className={`${abierto ? "block" : "hidden"} lg:block`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-3 md:px-6 lg:py-3">
        {/* Precio */}
        <div>
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
              aria-label="Precio máximo mensual"
              /* Sin `aria-valuetext` un lector de pantalla lee "1200000": un número
                 suelto, sin moneda ni periodicidad. Con él se oye la oferta entera. */
              aria-valuetext={`Hasta ${formatearCOP(filtros.precioMaximoCop)} al mes`}
              aria-describedby="ayuda-precio"
            />
            <output className="precio shrink-0 rounded-lg bg-accent-700 px-2.5 py-1 text-sm font-extrabold text-white" htmlFor="filtro-precio">
              Hasta {formatearCOP(filtros.precioMaximoCop)}
            </output>
          </div>
          {/* El rango del catálogo y el paso, que antes no se veían en ninguna parte:
              sin ellos se arrastra a ciegas sin saber cuánto queda por explorar.
              Con un solo precio no hay rango que anunciar: se dice el precio que hay,
              en lugar de un abanico con un tope que no corresponde a nada. */}
          <p id="ayuda-precio" className="mt-1 text-xs text-neutro-600">
            {limitesPrecio.min === limitesPrecio.max ? (
              <>
                Todas las habitaciones disponibles están en{" "}
                <span className="precio">{formatearCOP(limitesPrecio.max)}</span>
              </>
            ) : (
              <>
                Del catálogo: <span className="precio">{formatearCOP(limitesPrecio.min)}</span> a{" "}
                <span className="precio">{formatearCOP(limitesPrecio.max)}</span> · cada paso son{" "}
                <span className="precio">{formatearCOP(PASO_PRECIO)}</span>
              </>
            )}
          </p>
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

          {/* Cerrar el panel, con el recuento delante: es el paso que confirma que
              los filtros sirvieron de algo antes de volver al catálogo. */}
          <button
            type="button"
            onClick={cerrar}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-airbnb-rausch-hover px-6 text-base font-semibold text-white transition hover:bg-primary-700 lg:hidden"
          >
            {resultados === 1 ? "Ver 1 pensión" : `Ver ${resultados} pensiones`}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconoFiltro() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M3 5h18" />
      <path d="M6 12h12" />
      <path d="M10 19h4" />
    </svg>
  );
}

function IconoFlecha({ abierto }: { abierto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 transition ${abierto ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
