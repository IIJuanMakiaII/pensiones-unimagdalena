import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="resultados"
      tabIndex={-1}
      className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      {/* Casa dibujada, no emoji (tarea #56). El 🏠 lo dibuja el sistema operativo
          —cambia de forma en cada plataforma— y algunos lectores de pantalla lo
          anuncian por su nombre por delante del mensaje. */}<svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-12 w-12 text-neutro-300"
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.2V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.2" />
        <path d="M9.75 21v-5.5h4.5V21" />
      </svg>
      <h1 className="font-display text-2xl font-extrabold text-neutro-800">
        Pensión no encontrada
      </h1>
      <p className="max-w-md text-sm text-neutro-500">
        Esa pensión no está en nuestro catálogo o ya no se publica. Vuelve al
        listado para ver las opciones disponibles cerca de Unimagdalena.
      </p>
      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-xl bg-accent-700 px-6 text-base font-bold text-white transition hover:bg-accent-800"
      >
        Ver todas las pensiones
      </Link>
    </main>
  );
}
