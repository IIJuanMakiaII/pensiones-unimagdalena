/** Hero de la landing: propuesta de valor + 3 microsellos de confianza (§4.1 y §4.6). */
export default function Hero() {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-secondary-700 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #fff 1.5px, transparent 1.5px), radial-gradient(circle at 80% 60%, #fff 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-100 ring-1 ring-white/20">
          Santa Marta · Universidad del Magdalena
        </p>
        <h1 className="max-w-3xl font-display text-3xl font-extrabold leading-tight md:text-5xl">
          Pensiones verificadas a minutos de Unimagdalena, en Santa Marta
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-primary-100 md:text-lg">
          Vive a minutos caminando del campus con precios mensuales claros y
          reserva directa por WhatsApp. Elegimos y verificamos cada hogar para
          que tú, estudiante foráneo, y tus padres, decidan con tranquilidad.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#resultados"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-700 px-6 text-[15px] font-bold text-white shadow-lg transition hover:bg-accent-800"
          >
            Ver habitaciones disponibles
          </a>
          <a
            href="#confianza"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-white/10 px-6 text-[15px] font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20"
          >
            Conoce cómo funciona
          </a>
        </div>

        <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-white">
          <li className="flex items-center gap-2">
            <CheckBadge /> Verificación presencial
          </li>
          <li className="flex items-center gap-2">
            <CheckBadge /> Sin intermediarios
          </li>
          <li className="flex items-center gap-2">
            <CheckBadge /> Precios mensuales claros
          </li>
        </ul>
      </div>
    </header>
  );
}

function CheckBadge() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}
