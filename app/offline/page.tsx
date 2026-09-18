import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sin conexión",
  description: "No pudimos cargar la página por falta de conexión.",
  robots: { index: false, follow: false },
};

/** Página de respaldo que el service worker sirve cuando no hay red (PWA). */
export default function SinConexion() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutro-50 px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
          aria-hidden="true"
        >
          <path d="M2 8.8A16 16 0 0 1 22 8.8" />
          <path d="M5.5 12.6a11 11 0 0 1 13 0" />
          <path d="M9 16.3a5.5 5.5 0 0 1 6 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
          <path d="M3 3l18 18" />
        </svg>
      </span>
      <h1 className="mt-6 font-display text-2xl font-extrabold text-neutro-900">
        Parece que no hay conexión
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-neutro-600">
        Revisa tus datos o tu red Wi-Fi e inténtalo de nuevo. Si ya visitaste el
        catálogo antes, las pensiones que viste siguen disponibles aquí.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-base font-bold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
      >
        Reintentar
      </Link>
    </main>
  );
}
