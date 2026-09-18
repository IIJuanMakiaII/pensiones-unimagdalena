interface Props {
  /** 22 px en cards, 28 px en detalle */
  tamano?: "sm" | "md";
  className?: string;
}

/** Sello circular de verificación presencial (§4.6 del contrato). */
export default function SelloVerificado({ tamano = "sm", className = "" }: Props) {
  const medida = tamano === "md" ? "h-7 w-7" : "h-[22px] w-[22px]";
  return (
    <span
      title="Verificada por el equipo"
      aria-label="Pensión verificada por el equipo"
      className={`inline-flex items-center justify-center rounded-full bg-primary-500 shadow-sm ${medida} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}
