"use client";

import { useFavoritos } from "@/hooks/useFavoritos";

interface Props {
  pensionId: string;
  titulo: string;
  /** "tarjeta" = flotante sobre la imagen · "detalle" = botón con texto. */
  variante?: "tarjeta" | "detalle";
  className?: string;
}

/**
 * Botón de "Guardar en favoritos" (localStorage, sin necesidad de cuenta).
 * Accesible: usa `aria-pressed` y anuncia el cambio a lectores de pantalla.
 */
export default function BotonFavorito({
  pensionId,
  titulo,
  variante = "tarjeta",
  className = "",
}: Props) {
  const { esFavorito, alternar } = useFavoritos();
  const activo = esFavorito(pensionId);

  const alPulsar = (evento: React.MouseEvent<HTMLButtonElement>) => {
    // Evita que el clic abra el enlace de la tarjeta.
    evento.preventDefault();
    evento.stopPropagation();
    alternar(pensionId);
  };

  const etiqueta = activo
    ? `Quitar ${titulo} de favoritos`
    : `Guardar ${titulo} en favoritos`;

  const icono = (
    <svg
      viewBox="0 0 24 24"
      fill={activo ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={variante === "tarjeta" ? "h-5 w-5" : "h-5 w-5"}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19 10.5c0 5.15-7 9.5-7 9.5Z" />
    </svg>
  );

  if (variante === "detalle") {
    return (
      <button
        type="button"
        onClick={alPulsar}
        aria-pressed={activo}
        aria-label={etiqueta}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${
          activo
            ? "border-accent-500 bg-accent-50 text-accent-700"
            : "border-neutro-300 bg-white text-neutro-700 hover:bg-neutro-100"
        } ${className}`}
      >
        {icono}
        {activo ? "Guardada" : "Guardar"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-pressed={activo}
      aria-label={etiqueta}
      /* 44×44 px: estaba en 40 y era el control más pequeño de la tarjeta, en la
         esquina de la foto, donde fallar el toque es más probable. */
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-md backdrop-blur transition hover:bg-white ${
        activo ? "text-accent-500" : "text-neutro-600"
      } ${className}`}
    >
      {icono}
    </button>
  );
}
