import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="resultados"
      tabIndex={-1}
      className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <p className="text-5xl" aria-hidden="true">
        🏠
      </p>
      <h1 className="font-display text-2xl font-extrabold text-neutro-800">
        Pensión no encontrada
      </h1>
      <p className="max-w-md text-sm text-neutro-500">
        Esa pensión no está en nuestro catálogo o ya no se publica. Vuelve al
        listado para ver las opciones disponibles cerca de Unimagdalena.
      </p>
      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-xl bg-accent-700 px-6 text-[15px] font-bold text-white transition hover:bg-accent-800"
      >
        Ver todas las pensiones
      </Link>
    </main>
  );
}
