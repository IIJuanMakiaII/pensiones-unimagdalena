"use client";

import Image from "next/image";
import { useState } from "react";

interface Props {
  src: string;
  alt: string;
  /** Tamaños responsivos que Next usa para elegir la resolución. */
  sizes: string;
  /** Solo en la primera foto visible (LCP). */
  priority?: boolean;
  className?: string;
}

/**
 * Marco de foto que respeta la orientación de la imagen.
 *
 * **El problema que resuelve:** las fotos de celular suelen ser verticales.
 * Al forzarlas en un marco apaisado con `object-cover`, el recorte era tan
 * agresivo que la habitación parecía un primer plano sin contexto.
 *
 * **La solución:** si la foto es vertical se muestra **completa**
 * (`object-contain`) sobre un fondo difuminado de la propia foto; si es
 * horizontal se recorta normalmente (`object-cover`), que es lo correcto.
 * El fondo difuminado reutiliza el MISMOS archivo ya optimizado, así que no
 * genera ninguna petición de red adicional.
 */
export default function FotoMarco({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
}: Props) {
  // null = todavía no se conoce la orientación (se asume apaisada, como antes).
  const [esVertical, setEsVertical] = useState<boolean | null>(null);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-neutro-100 ${className}`}>
      {esVertical && (
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className="scale-110 object-cover blur-xl"
        />
      )}

      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        onLoad={(evento) => {
          const imagen = evento.currentTarget;
          setEsVertical(imagen.naturalHeight > imagen.naturalWidth);
        }}
        className={
          esVertical === null || esVertical === false
            ? "object-cover"
            : "object-contain drop-shadow-lg"
        }
      />
    </div>
  );
}
