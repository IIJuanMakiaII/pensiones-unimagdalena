"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Frontera de error de la aplicación: si un Server Component falla (por ejemplo,
 * Supabase no responde), el estudiante ve un mensaje claro y un botón para
 * reintentar, en lugar de una pantalla rota del navegador.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error de la aplicación:", error);
  }, [error]);

  return (
    <main
      id="resultados"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center bg-neutro-50 px-6 py-16 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-accent-700" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-7 w-7">
          <path d="M12 8v5" />
          <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
          <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-neutro-900">
        Algo no cargó como esperábamos
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-neutro-600">
        Tuvimos un problema temporal al traer las pensiones. Tus filtros y favoritos
        siguen guardados: puedes reintentar o volver al inicio.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-primary-600 px-6 text-[15px] font-bold text-white transition hover:bg-primary-700"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-neutro-300 px-6 text-[15px] font-bold text-neutro-700 transition hover:bg-neutro-100"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
