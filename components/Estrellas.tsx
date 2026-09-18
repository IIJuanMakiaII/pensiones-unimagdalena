interface Props {
  calificacion: number; // 0–5, un decimal
  tamano?: "sm" | "md";
}

/** Estrellas en el naranja de marca (accent-500) con relleno proporcional a la calificación. */
export default function Estrellas({ calificacion, tamano = "sm" }: Props) {
  const porcentaje = Math.max(0, Math.min(5, calificacion)) / 5;
  const medida = tamano === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className="relative inline-flex"
      role="img"
      aria-label={`Calificación ${calificacion.toFixed(1)} de 5`}
    >
      <span className="flex text-neutro-300" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={medida} />
        ))}
      </span>
      <span
        className="absolute inset-0 flex overflow-hidden text-accent-500"
        style={{ width: `${porcentaje * 100}%` }}
        aria-hidden="true"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`${medida} shrink-0`} />
        ))}
      </span>
    </span>
  );
}

function Star({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 0 0-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69l1.07-3.29Z" />
    </svg>
  );
}
