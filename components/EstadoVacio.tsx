interface Props {
  onLimpiar: () => void;
  /**
   * Filtro que dejaría ver más resultados si se quitara. Se calcula en el motor
   * puro (`filtroQueMasBloquea`): sin esto el mensaje solo puede sugerir "quita
   * filtros", y quien filtró por género recibe un consejo sobre el precio que no
   * le sirve.
   */
  bloqueante?: { etiqueta: string; resultadosAlQuitar: number } | null;
  /** Quitar solo el filtro señalado, sin perder el resto de la búsqueda. */
  onQuitarBloqueante?: () => void;
}

/** Estado vacío del catálogo: dice qué pasa, qué hacer y lo deja a un toque (§5.5). */
export default function EstadoVacio({ onLimpiar, bloqueante = null, onQuitarBloqueante }: Props) {
  const haySalidaParcial = Boolean(bloqueante && onQuitarBloqueante && bloqueante.resultadosAlQuitar > 0);

  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-neutro-300 bg-white px-6 py-14 text-center"
    >
      <span className="text-4xl" aria-hidden="true">
        🏠
      </span>
      <div>
        <h2 className="font-display text-lg font-bold text-neutro-800">
          Ninguna pensión coincide con tus filtros
        </h2>
        {bloqueante ? (
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-neutro-600">
            Con <strong className="font-semibold text-neutro-800">{bloqueante.etiqueta}</strong> no
            hay coincidencias ahora mismo.{" "}
            {bloqueante.resultadosAlQuitar > 0
              ? `Sin ese filtro verías ${
                  bloqueante.resultadosAlQuitar === 1
                    ? "1 pensión"
                    : `${bloqueante.resultadosAlQuitar} pensiones`
                }.`
              : "Puedes probar a quitar varios filtros a la vez."}
          </p>
        ) : (
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-neutro-600">
            Prueba subiendo el precio máximo o quitando algunos filtros.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {haySalidaParcial && (
          <button
            type="button"
            onClick={onQuitarBloqueante}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-accent-700 px-6 text-[15px] font-bold text-white transition hover:bg-accent-800"
          >
            Quitar ese filtro
          </button>
        )}
        <button
          type="button"
          onClick={onLimpiar}
          className={`inline-flex h-12 items-center justify-center rounded-xl px-6 text-[15px] font-bold transition ${
            haySalidaParcial
              ? "border border-primary-600 bg-white text-primary-700 hover:bg-primary-50"
              : "bg-accent-700 text-white hover:bg-accent-800"
          }`}
        >
          Limpiar todos los filtros
        </button>
      </div>
    </div>
  );
}
