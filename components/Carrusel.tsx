"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import FotoMarco from "@/components/FotoMarco";
import { comportamientoScroll } from "@/lib/accesibilidad";

interface Props {
  imagenes: string[];
  altBase: string;
  /**
   * Si se indica, cada foto enlaza al detalle.
   *
   * El enlace vive DENTRO de cada diapositiva (no envolviendo el carrusel): así
   * los botones de flechas y puntos quedan fuera del `<a>`. Antes el carrusel
   * entero iba dentro de un `<Link>` y los botones acababan anidados dentro de
   * un enlace — HTML inválido que rompe la navegación con teclado y lectores de
   * pantalla.
   */
  href?: string;
  /** Solo en la primera card (LCP del hero). */
  priority?: boolean;
  className?: string;
  /**
   * En las tarjetas del grid: monta únicamente las imágenes ya alcanzadas
   * (la portada y las que el usuario desliza). Evita que 6 tarjetas pidan
   * 18 fotos al cargar cuando solo se ve la primera de cada carrusel.
   */
  diferirImagenes?: boolean;
}

/**
 * Carrusel Mobile-First: scroll horizontal nativo con snap (sin flechas en
 * móvil), indicador de puntos y flechas en desktop (§4.3 del contrato).
 */
export default function Carrusel({
  imagenes,
  altBase,
  href,
  priority = false,
  className = "",
  diferirImagenes = false,
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  const [activas, setActivas] = useState<Set<number>>(() => new Set([0]));
  const total = imagenes.length;

  const manejarScroll = useCallback(() => {
    const el = contenedorRef.current;
    if (!el) return;
    setIndice(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
  }, [total]);

  const mover = useCallback((dir: 1 | -1) => {
    const el = contenedorRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: comportamientoScroll() });
  }, []);

  // Activa la foto actual y la siguiente: la que sigue ya está lista al deslizar.
  useEffect(() => {
    if (!diferirImagenes) return;

    setActivas((previas) => {
      if (previas.has(indice) && (indice + 1 >= total || previas.has(indice + 1))) return previas;

      const siguientes = new Set(previas);
      siguientes.add(indice);
      if (indice + 1 < total) siguientes.add(indice + 1);
      return siguientes;
    });
  }, [indice, total, diferirImagenes]);

  if (total === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label={`Galería de ${altBase}`}
      className={`group/carrusel relative ${className}`}
    >
      <div
        ref={contenedorRef}
        onScroll={manejarScroll}
        className="flex h-full snap-x snap-mandatory overflow-x-auto scrollbar-oculto"
      >
        {imagenes.map((src, i) => {
          const mostrar = !diferirImagenes || activas.has(i);

          return (
            <div key={src + i} className="relative h-full w-full shrink-0 snap-center">
              {mostrar ? (
                href ? (
                  <Link href={href} className="block h-full w-full">
                    <FotoMarco
                      src={src}
                      alt={`${altBase} — foto ${i + 1} de ${total}`}
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      priority={priority && i === 0}
                    />
                  </Link>
                ) : (
                  <FotoMarco
                    src={src}
                    alt={`${altBase} — foto ${i + 1} de ${total}`}
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    priority={priority && i === 0}
                  />
                )
              ) : (
                /* Marcador mientras no se necesita la foto (no se descarga). */
                <div className="h-full w-full bg-neutro-100" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {/* Flechas (solo desktop) */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Imagen anterior"
            className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutro-800 shadow-md transition hover:bg-white md:flex"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Imagen siguiente"
            className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutro-800 shadow-md transition hover:bg-white md:flex"
          >
            ›
          </button>
        </>
      )}

      {/* Indicador de puntos.
          El punto visible mide 8 px, pero lo que se toca es el botón: 44×44 px, el
          mínimo del contrato Mobile-First. Con más de 6 fotos —el tope son 8— ocho
          áreas de 44 px no caben en el ancho de un móvil, así que baja a 24×24 px,
          que es el mínimo exigible por WCAG 2.5.8 y sigue sin solaparse. */}
      {total > 1 && (
        <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 justify-center">
          {imagenes.map((src, i) => (
            <button
              key={src + i}
              type="button"
              aria-label={`Ir a la foto ${i + 1}`}
              aria-current={i === indice}
              onClick={() => {
                const el = contenedorRef.current;
                el?.scrollTo({ left: i * el.clientWidth, behavior: comportamientoScroll() });
              }}
              className={`flex items-center justify-center ${total > 6 ? "h-6 w-6" : "h-11 w-11"}`}
            >
              <span
                className={`h-2 w-2 rounded-full transition ${
                  i === indice ? "bg-white shadow" : "bg-white/50"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
