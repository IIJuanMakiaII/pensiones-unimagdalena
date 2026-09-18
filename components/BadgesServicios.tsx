interface Props {
  servicios: string[];
  /** Máximo de chips visibles antes del "+N" (por defecto 3, según contrato §4.4). */
  maxVisibles?: number;
}

/** Chips de servicios: máx. 3 visibles + "+N" enmascarado. */
export default function BadgesServicios({ servicios, maxVisibles = 3 }: Props) {
  const visibles = servicios.slice(0, maxVisibles);
  const ocultos = servicios.length - visibles.length;

  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Servicios incluidos">
      {visibles.map((s) => (
        <li
          key={s}
          className="rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-800"
        >
          {s}
        </li>
      ))}
      {ocultos > 0 && (
        <li className="rounded-full bg-neutro-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutro-600">
          +{ocultos}
        </li>
      )}
    </ul>
  );
}
