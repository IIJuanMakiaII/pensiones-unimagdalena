"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PensionConHabitaciones } from "@/types";
import {
  ETIQUETA_ORDEN,
  FILTROS_INICIALES,
  ORDEN_POR_DEFECTO,
  aplicarFiltros,
  contarHabitacionesDisponibles,
  filtroQueMasBloquea,
  filtrosAParametros,
  limitesDePrecio,
  parametrosAFiltros,
  quitarFiltro,
  type FiltrosUI,
  type Orden,
} from "@/lib/filtros";
import { useFavoritos } from "@/hooks/useFavoritos";
import { medirFiltros } from "@/lib/medicion";
import Filtros from "@/components/Filtros";
import CardPension from "@/components/CardPension";
import EstadoVacio from "@/components/EstadoVacio";

interface Props {
  pensiones: PensionConHabitaciones[];
  /** Catálogo de ejemplo para presentaciones (vacío si la demo está deshabilitada). */
  pensionesDemo: PensionConHabitaciones[];
  demoHabilitada: boolean;
}

/**
 * ÚNICO bloque interactivo de la landing (panel de filtros + resultados).
 *
 * Todo lo demás —hero, sellos y footer— se renderiza en el servidor.
 *
 * Incluye el MODO DEMOSTRACIÓN: permite mostrar el producto con las 6 pensiones
 * de ejemplo aunque la base de datos aún no tenga publicaciones. Nunca se activa
 * en silencio: se enciende con un botón (o con el enlace `?demo=1`, que se puede
 * compartir) y mientras está activo se muestra un aviso permanente.
 */
export default function CatalogoInteractivo({ pensiones, pensionesDemo, demoHabilitada }: Props) {
  const [modoDemo, setModoDemo] = useState(false);
  const activas = modoDemo ? pensionesDemo : pensiones;
  const limitesPrecio = useMemo(() => limitesDePrecio(activas), [activas]);

  const [filtros, setFiltros] = useState<FiltrosUI>(() => ({
    ...FILTROS_INICIALES,
    precioMaximoCop: limitesDePrecio(pensiones).max,
  }));

  const { favoritos, total: totalFavoritos } = useFavoritos();

  const rutaActual = usePathname();
  const router = useRouter();
  const yaRestaurado = useRef(false);

  /**
   * Deja filtros y modo demo igual que la URL actual. La URL es la fuente de
   * verdad de la búsqueda: es lo que hace que un enlace compartido por WhatsApp
   * abra exactamente la búsqueda que la otra persona envió.
   */
  const sincronizarDesdeUrl = useCallback(() => {
    const consulta = new URLSearchParams(window.location.search);
    const pideDemo = consulta.get("demo") === "1" && demoHabilitada;
    setModoDemo(pideDemo);

    const base = pideDemo ? pensionesDemo : pensiones;
    setFiltros(parametrosAFiltros(consulta, limitesDePrecio(base).max));
  }, [demoHabilitada, pensiones, pensionesDemo]);

  // 1) Al abrir un enlace compartido, reconstruye filtros y modo demo desde la URL.
  useEffect(() => {
    if (yaRestaurado.current) return;
    yaRestaurado.current = true;

    const consulta = new URLSearchParams(window.location.search);
    const pideDemo = consulta.get("demo") === "1" && demoHabilitada;
    if (pideDemo) setModoDemo(true);

    if (Array.from(consulta.keys()).length === 0) return;

    const base = pideDemo ? pensionesDemo : pensiones;
    setFiltros(parametrosAFiltros(consulta, limitesDePrecio(base).max));
  }, [demoHabilitada, pensiones, pensionesDemo]);

  /**
   * 2) Atrás y Adelante del navegador.
   *
   * Los cambios de filtro escriben la URL con `replace` (arrastrar el deslizador
   * no debe llenar el historial de entradas), así que la URL puede cambiar sin
   * que el estado se entere. Escuchando `popstate` los filtros vuelven a leerse
   * de la dirección, y lo que se ve coincide siempre con lo que dice la barra.
   */
  useEffect(() => {
    window.addEventListener("popstate", sincronizarDesdeUrl);
    return () => window.removeEventListener("popstate", sincronizarDesdeUrl);
  }, [sincronizarDesdeUrl]);

  /** Escribe en la URL los filtros activos (y si la demo está encendida). */
  const escribirUrl = (nuevos: FiltrosUI, demo: boolean, maximo: number) => {
    const parametros = filtrosAParametros(nuevos, maximo);
    if (demo) parametros.set("demo", "1");
    const consulta = parametros.toString();
    router.replace(consulta ? `${rutaActual}?${consulta}` : rutaActual, { scroll: false });
  };

  const cambiarFiltros = (nuevos: FiltrosUI) => {
    setFiltros(nuevos);
    escribirUrl(nuevos, modoDemo, limitesPrecio.max);
  };

  /** Enciende o apaga el modo demostración reiniciando los filtros al nuevo rango. */
  const alternarDemo = () => {
    const encender = !modoDemo;
    const base = encender ? pensionesDemo : pensiones;
    const nuevoMaximo = limitesDePrecio(base).max;
    const nuevosFiltros: FiltrosUI = { ...FILTROS_INICIALES, precioMaximoCop: nuevoMaximo };

    setModoDemo(encender);
    setFiltros(nuevosFiltros);
    escribirUrl(nuevosFiltros, encender, nuevoMaximo);
  };

  const resultados = useMemo(
    () => aplicarFiltros(activas, filtros, limitesPrecio.max, favoritos),
    [activas, filtros, favoritos]
  );

  /** Habitaciones reservables con los filtros puestos: el estudiante busca una habitación. */
  const habitacionesLibres = useMemo(
    () => contarHabitacionesDisponibles(resultados, filtros),
    [resultados, filtros]
  );

  /**
   * Qué filtro deja el catálogo vacío. Solo se calcula cuando no hay resultados:
   * es un dato para el mensaje, no para la lista.
   */
  const bloqueante = useMemo(
    () =>
      resultados.length === 0 && activas.length > 0
        ? filtroQueMasBloquea(activas, filtros, limitesPrecio.max, favoritos)
        : null,
    [resultados.length, activas, filtros, limitesPrecio.max, favoritos]
  );

  /**
   * Medición de filtros, con retardo a propósito: arrastrar el slider emite
   * decenas de cambios y enviar uno por píxel llenaría la medición de ruido sin
   * aportar nada. Un segundo y medio después del último cambio se registra el
   * estado en el que el estudiante se quedó, junto con cuántos resultados vio.
   */
  useEffect(() => {
    const temporizador = setTimeout(() => {
      medirFiltros({
        precio_maximo: filtros.precioMaximoCop,
        genero: filtros.genero,
        distancia: filtros.rangoDistancia,
        alimentacion: filtros.soloConAlimentacion,
        solo_verificadas: filtros.soloVerificadas,
        solo_favoritas: filtros.soloFavoritas,
        orden: filtros.orden ?? ORDEN_POR_DEFECTO,
        habitaciones_libres: habitacionesLibres,
        resultados: resultados.length,
      });
    }, 1500);

    return () => clearTimeout(temporizador);
  }, [filtros, resultados.length]);

  const limpiar = () =>
    cambiarFiltros({ ...FILTROS_INICIALES, precioMaximoCop: limitesPrecio.max });

  return (
    <>
      <Filtros
        filtros={filtros}
        onChange={cambiarFiltros}
        limitesPrecio={limitesPrecio}
        totalFavoritos={totalFavoritos}
      />

      <main id="resultados" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {modoDemo && (
          <div
            role="status"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3"
          >
            <p className="text-sm font-semibold text-accent-800">
              🎓 Modo demostración: estás viendo 6 pensiones de ejemplo. No son
              publicaciones reales.
            </p>
            <button
              type="button"
              onClick={alternarDemo}
              className="inline-flex h-11 items-center rounded-xl border border-accent-300 bg-white px-3 text-xs font-bold text-accent-800 transition hover:bg-accent-100"
            >
              Ver catálogo real
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* El recuento nombra habitaciones, no solo pensiones: es lo que el
              estudiante viene a buscar, y se cuenta con sus filtros puestos para
              no prometer nada que no pueda alquilar. */}
          <p aria-live="polite" className="text-sm font-semibold text-neutro-600">
            {resultados.length === 1 ? "1 pensión" : `${resultados.length} pensiones`}
            {habitacionesLibres > 0 && (
              <>
                {" · "}
                {habitacionesLibres === 1
                  ? "1 habitación disponible"
                  : `${habitacionesLibres} habitaciones disponibles`}
              </>
            )}{" "}
            cerca de Unimagdalena
            {totalFavoritos > 0 && (
              <span className="ml-2 font-normal text-neutro-500">
                · {totalFavoritos === 1 ? "1 guardada" : `${totalFavoritos} guardadas`} en tus favoritas
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {demoHabilitada && !modoDemo && (
              <button
                type="button"
                onClick={alternarDemo}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-accent-500 bg-white px-4 text-sm font-bold text-accent-700 transition hover:bg-accent-50"
              >
                🎓 Ver demostración
              </button>
            )}
            <Link
              href="/publicar"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary-600 px-4 text-sm font-bold text-primary-700 transition hover:bg-primary-50"
            >
              + Publicar mi pensión
            </Link>
          </div>
        </div>

        {/* Ordenar. Va con los resultados —no en la barra de filtros— porque es
            donde se busca al mirar una lista y querer reordenarla. El color lo
            separa de los filtros (verde = ordenar, naranja = filtrar): así una
            palabra por significado, que es lo que permite aprender la interfaz
            en dos pantallas. */}
        {resultados.length > 1 && (
          <div role="group" aria-label="Ordenar resultados" className="mb-4 flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-neutro-700">Ordenar</span>
            {(Object.keys(ETIQUETA_ORDEN) as Orden[]).map((opcion) => {
              const activo = (filtros.orden ?? ORDEN_POR_DEFECTO) === opcion;
              return (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => cambiarFiltros({ ...filtros, orden: opcion })}
                  className={`h-11 rounded-full px-4 text-sm font-semibold transition ${
                    activo
                      ? "bg-primary-600 text-white shadow-sm"
                      : "border border-neutro-300 bg-white text-neutro-700 hover:border-primary-400"
                  }`}
                >
                  {ETIQUETA_ORDEN[opcion]}
                </button>
              );
            })}
          </div>
        )}

        {activas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutro-300 bg-white p-8 text-center">
            <h2 className="font-display text-lg font-bold text-neutro-800">
              Todavía no hay pensiones publicadas
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutro-600">
              Sé el primero: publica tu pensión o habitación y aparecerá aquí para
              los estudiantes de la Universidad del Magdalena.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/publicar"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-primary-600 px-6 text-[15px] font-bold text-white transition hover:bg-primary-700"
              >
                Publicar mi pensión
              </Link>
              {demoHabilitada && (
                <button
                  type="button"
                  onClick={alternarDemo}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-accent-500 bg-white px-6 text-[15px] font-bold text-accent-700 transition hover:bg-accent-50"
                >
                  🎓 Ver la demostración
                </button>
              )}
            </div>
          </div>
        ) : resultados.length === 0 ? (
          <EstadoVacio
            onLimpiar={limpiar}
            bloqueante={bloqueante}
            onQuitarBloqueante={
              bloqueante
                ? () => cambiarFiltros(quitarFiltro(filtros, bloqueante.clave, limitesPrecio.max))
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {resultados.map((pension, i) => (
              <div key={pension.id} className="animar-aparecer">
                <CardPension pension={pension} filtros={filtros} prioridadImagen={i === 0} />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
