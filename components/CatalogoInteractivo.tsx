"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PensionConHabitaciones } from "@/types";
import {
  aplicarFiltros,
  FILTROS_INICIALES,
  filtrosAParametros,
  limitesDePrecio,
  parametrosAFiltros,
  type FiltrosUI,
} from "@/lib/filtros";
import { useFavoritos } from "@/hooks/useFavoritos";
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
              className="inline-flex h-10 items-center rounded-xl border border-accent-300 bg-white px-3 text-xs font-bold text-accent-800 transition hover:bg-accent-100"
            >
              Ver catálogo real
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm font-semibold text-neutro-600">
            {resultados.length === 1
              ? "1 pensión cerca de Unimagdalena"
              : `${resultados.length} pensiones cerca de Unimagdalena`}
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
          <EstadoVacio onLimpiar={limpiar} />
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
