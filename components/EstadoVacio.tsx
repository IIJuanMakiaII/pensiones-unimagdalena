interface Props {
  onLimpiar: () => void;
}

/** Estado vacío del catálogo: mensaje claro + limpiar filtros en 1 tap (§5.5). */
export default function EstadoVacio({ onLimpiar }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-neutro-300 bg-white px-6 py-14 text-center">
      <span className="text-4xl" aria-hidden="true">
        🏠
      </span>
      <div>
        <h2 className="font-display text-lg font-bold text-neutro-800">
          Ninguna pensión coincide con tus filtros
        </h2>
        <p className="mt-1 text-sm text-neutro-500">
          Prueba subiendo el precio máximo o quitando algunos filtros.
        </p>
      </div>
      <button
        type="button"
        onClick={onLimpiar}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-accent-700 px-6 text-[15px] font-bold text-white transition hover:bg-accent-800"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
