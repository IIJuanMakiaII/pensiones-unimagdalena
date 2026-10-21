"use client";

import { useRef, useState, type RefObject } from "react";
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
 *
 * POR QUÉ HAY DOS ESTADOS Y NO UNO (tarea #96)
 * -------------------------------------------
 * El mecanismo de plegado existía, pero solo en móvil: la barra con el botón
 * llevaba `lg:hidden` y el panel `lg:block`, así que en escritorio el botón no se
 * pintaba y el panel estaba forzado a visible. El estado era inútil ahí.
 *
 * Para habilitarlo en escritorio sin cambiar nada en móvil hacen falta **dos
 * estados**, porque el punto de partida es distinto en cada familia de pantallas:
 *
 *   - `abierto` (móvil y tablet): arranca **plegado**, como hoy. Se abre al pulsar.
 *   - `plegado` (escritorio): arranca **desplegado**, para que quien llega vea el
 *     catálogo como siempre; plegar es una acción suya.
 *
 * Un único estado no puede arrancar en dos valores a la vez. La alternativa
 * evidente —leer `matchMedia` al montar— obliga a dibujar primero una cosa y
 * corregirla después en el cliente: un parpadeo del panel en cada carga de
 * escritorio, y un desajuste entre el HTML del servidor y el del cliente. Con dos
 * estados el CSS decide qué botón y qué regla aplican en cada ancho, y no hay ni
 * parpadeo ni trabajo de hidratación.
 *
 * Plegar **oculta, no desmonta**: los valores no viven aquí sino en el estado del
 * catálogo y en la URL, y desmontar destruiría además el estado interno de los
 * controles (la posición del deslizador, el desplazamiento del panel). Con
 * `display:none` —lo que hace `hidden`— el panel desaparece, sus controles dejan
 * de recibir foco, y nada de lo elegido se toca.
 */
export default function Filtros({
  filtros,
  onChange,
  limitesPrecio,
  totalFavoritos = 0,
  resultados,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  /** Solo afecta a partir de 1024 px; en móvil y tablet manda `abierto`. */
  const [plegado, setPlegado] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const botonEscritorioRef = useRef<HTMLButtonElement>(null);

  const actualizar = (parcial: Partial<FiltrosUI>) => onChange({ ...filtros, ...parcial });

  const activos = filtrosActivos(filtros, limitesPrecio.max);

  /**
   * ¿El catálogo ofrece más de un precio?
   *
   * Es la condición que decide si el deslizador existe. Con un solo precio —o con
   * ninguno, cuando el catálogo está vacío— no hay rango que recorrer.
   */
  const hayRangoDePrecio = limitesPrecio.max > limitesPrecio.min;

  /** Quitar todos conserva el orden elegido: no es un filtro, es cómo se mira la lista. */
  const quitarTodos = () =>
    onChange({ ...FILTROS_INICIALES, precioMaximoCop: limitesPrecio.max, orden: filtros.orden });

  /** Cerrar y devolver el foco al botón: si no, en el móvil el foco se queda perdido. */
  const cerrar = () => {
    setAbierto(false);
    botonRef.current?.focus();
  };

  /**
   * Plegar o desplegar en escritorio.
   *
   * El foco se devuelve al botón a mano por la misma razón que en `cerrar`: si se
   * pliega mientras el foco está en un control del panel, ese control desaparece
   * (`display:none`) y el foco se perdería en el `body`. Y no todos los navegadores
   * enfocan un `<button>` al pulsarlo con el ratón, así que no se deja al azar.
   */
  const plegar = () => {
    setPlegado((v) => !v);
    botonEscritorioRef.current?.focus();
  };

  return (
    <div className="sticky top-0 z-30 border-b border-neutro-200 bg-white/95 backdrop-blur">
      {/*
        Dos barras, un solo panel. La de móvil/tablet ya existía; la de escritorio
        es la nueva (tarea #96) y usa el mismo botón y el mismo estilo, porque
        «coherente con Nido» significa reutilizar el control que el estudiante ya
        conoce, no inventar otro. Cada una solo se pinta en su ancho, así que la
        oculta no estorba al teclado ni al lector de pantalla.
      */}
      <BarraFiltros
        className="lg:hidden"
        abierto={abierto}
        activos={activos.length}
        botonRef={botonRef}
        onToggle={() => setAbierto((v) => !v)}
        onQuitar={quitarTodos}
        classBoton="flex-1"
      />

      <BarraFiltros
        className="hidden lg:flex"
        abierto={!plegado}
        activos={activos.length}
        botonRef={botonEscritorioRef}
        onToggle={plegar}
        onQuitar={quitarTodos}
      />

      <div
        id="panel-filtros"
        className={`${abierto ? "block" : "hidden"} ${plegado ? "lg:hidden" : "lg:block"}`}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-3 md:px-6 lg:py-3">
        {/* Precio */}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Con un solo precio en el catálogo no hay nada que deslizar: el control
                tenía `min` y `max` idénticos —un rango de cero—, así que arrastrarlo no
                movía nada y anunciaba un abanico que no existe. Cuando eso pasa el
                deslizador no se pinta: se dice el precio que hay. */}
            {hayRangoDePrecio ? (
              <>
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
                  className="h-2 w-full min-w-[8rem] flex-1 accent-accent-500"
                  aria-label="Precio máximo mensual"
                  /* Sin `aria-valuetext` un lector de pantalla lee "1200000": un número
                     suelto, sin moneda ni periodicidad. Con él se oye la oferta entera. */
                  aria-valuetext={`Hasta ${formatearCOP(filtros.precioMaximoCop)} al mes`}
                  aria-describedby="ayuda-precio"
                />
                <output
                  className="precio shrink-0 rounded-lg bg-accent-700 px-2.5 py-1 text-sm font-extrabold text-white"
                  htmlFor="filtro-precio"
                >
                  Hasta {formatearCOP(filtros.precioMaximoCop)}
                </output>
              </>
            ) : (
              <>
                <span className="shrink-0 text-sm font-semibold text-neutro-700">Precio</span>
                <output
                  id="ayuda-precio"
                  className="precio shrink-0 rounded-lg bg-accent-700 px-2.5 py-1 text-sm font-extrabold text-white"
                >
                  {formatearCOP(limitesPrecio.max)} al mes
                </output>
              </>
            )}
          </div>
          {/* El rango del catálogo y el paso, que antes no se veían en ninguna parte:
              sin ellos se arrastra a ciegas sin saber cuánto queda por explorar. Con
              un solo precio esa ayuda sobra: la cifra ya está arriba, en el lugar del
              deslizador, y repetirla dos veces seguidas solo añade ruido. */}
          {hayRangoDePrecio && (
            <p id="ayuda-precio" className="mt-1 text-xs text-neutro-600">
              Del catálogo: <span className="precio">{formatearCOP(limitesPrecio.min)}</span> a{" "}
              <span className="precio">{formatearCOP(limitesPrecio.max)}</span> · cada paso son{" "}
              <span className="precio">{formatearCOP(PASO_PRECIO)}</span>
            </p>
          )}
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
            className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
              filtros.soloConAlimentacion
                ? "bg-accent-700 text-white shadow-sm"
                : "border border-neutro-300 bg-white text-neutro-700 hover:border-accent-400"
            }`}
          >
            <IconoAlimentacion />
            Con alimentación
          </button>
          <button
            type="button"
            aria-pressed={filtros.soloVerificadas}
            onClick={() => actualizar({ soloVerificadas: !filtros.soloVerificadas })}
            className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
              filtros.soloVerificadas
                ? "bg-primary-600 text-white shadow-sm"
                : "border border-neutro-300 bg-white text-neutro-700 hover:border-primary-400"
            }`}
          >
            <IconoVerificado />
            Solo verificadas
          </button>
          <button
            type="button"
            aria-pressed={filtros.soloFavoritas}
            onClick={() => actualizar({ soloFavoritas: !filtros.soloFavoritas })}
            className={`inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
              filtros.soloFavoritas
                ? "bg-accent-700 text-white shadow-sm"
                : "border border-neutro-300 bg-white text-neutro-700 hover:border-accent-400"
            }`}
          >
            <IconoCorazon relleno={filtros.soloFavoritas} />
            Mis favoritas{totalFavoritos > 0 ? ` (${totalFavoritos})` : ""}
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

/**
 * La fila que se queda pegada arriba mientras se recorre el catálogo: el botón de
 * plegar y, si hay filtros puestos, el atajo para quitarlos.
 *
 * Existe una por familia de pantallas —móvil/tablet y escritorio— porque cada una
 * controla un estado distinto (ver el comentario de `Filtros`). El aspecto es el
 * mismo en las dos a propósito.
 */
function BarraFiltros({
  abierto,
  activos,
  onToggle,
  onQuitar,
  botonRef,
  className = "",
  classBoton = "",
}: {
  abierto: boolean;
  activos: number;
  onToggle: () => void;
  onQuitar: () => void;
  botonRef: RefObject<HTMLButtonElement>;
  className?: string;
  classBoton?: string;
}) {
  return (
    <div className={`mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 md:px-6 ${className}`}>
      <BotonFiltros
        abierto={abierto}
        activos={activos}
        onClick={onToggle}
        botonRef={botonRef}
        className={classBoton}
      />

      {activos > 0 && (
        <button
          type="button"
          onClick={onQuitar}
          className="inline-flex h-11 shrink-0 items-center rounded-xl px-3 text-sm font-bold text-accent-700 underline underline-offset-2 transition hover:text-accent-800"
        >
          Quitar
        </button>
      )}
    </div>
  );
}

/**
 * El botón de plegar y desplegar.
 *
 * Tres cosas dicen el estado a la vez, para que no haya que adivinarlo: la flecha
 * gira (dirección del cambio), `aria-expanded` lo anuncia al lector de pantalla, y
 * el contador de filtros activos sigue visible **con el panel plegado** —que es lo
 * que evita perder la cuenta de lo que se tiene aplicado mientras se navega.
 *
 * El nombre accesible lleva delante la acción («Mostrar» / «Ocultar») porque
 * `aria-expanded` dice el estado, pero no qué hace el botón; y va en un `sr-only`
 * para no repetirlo en pantalla, donde la flecha ya lo sugiere.
 */
function BotonFiltros({
  abierto,
  activos,
  onClick,
  botonRef,
  className = "",
}: {
  abierto: boolean;
  activos: number;
  onClick: () => void;
  botonRef: RefObject<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <button
      ref={botonRef}
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      aria-controls="panel-filtros"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border border-neutro-200 bg-white px-4 text-sm font-semibold text-neutro-800 transition hover:border-neutro-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700 ${className}`}
    >
      <IconoFiltro />
      <span className="sr-only">{abierto ? "Ocultar" : "Mostrar"}</span>
      {activos > 0 ? `Filtros (${activos})` : "Filtros"}
      <IconoFlecha abierto={abierto} />
    </button>
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

/*
 * Iconos de los tres filtros «extras».
 *
 * Antes eran emoji (🍽️ ✓ ♥). Un emoji lo dibuja el sistema operativo, así que el
 * mismo filtro se ve distinto en Android, iOS y Windows; y un lector de pantalla lo
 * anuncia por su nombre —«cubiertos y cuchillo con tenedor»—, que se suma al rótulo
 * y deja el botón diciendo dos veces lo mismo. Estos son SVG en línea, heredan el
 * color del texto (así funcionan en los dos estados, activo e inactivo) y van con
 * `aria-hidden="true"`: el nombre accesible es el rótulo, y nada más.
 */

function IconoAlimentacion() {
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
      <path d="M6 3v7a2 2 0 0 0 4 0V3" />
      <path d="M8 10v11" />
      <path d="M16 3c-1.5 1.5-2 3.5-2 6v5h4V3Z" />
      <path d="M16 14v7" />
    </svg>
  );
}

function IconoVerificado() {
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
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </svg>
  );
}

/** El corazón se rellena cuando el filtro está puesto: es el único estado que cambia. */
function IconoCorazon({ relleno }: { relleno: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={relleno ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M12 20.2 4.9 13.4a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5Z" />
    </svg>
  );
}
