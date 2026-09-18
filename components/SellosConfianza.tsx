interface Sello {
  titulo: string;
  descripcion: string;
  icono: React.ReactNode;
}

/** Iconos SVG inline (sin dependencias externas), con trazo heredable. */
const iconos = {
  verificacion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <path d="M12 2 4 5.5v5.1c0 4.9 3.4 9.5 8 10.9 4.6-1.4 8-6 8-10.9V5.5L12 2Z" />
      <path d="m8.7 11.8 2.2 2.3 4.4-4.6" />
    </svg>
  ),
  directo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M8.5 15c.6 1 1.9 1.7 3.5 1.7s2.9-.7 3.5-1.7M9.3 9.6h.01M14.7 9.6h.01" />
      <path d="M12 12v4" />
    </svg>
  ),
  precio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <path d="M12 2v20M17 6.5c0-1.4-2.2-2.5-5-2.5s-5 1.1-5 2.5 2.2 2.5 5 2.5 5 1.1 5 2.5-2.2 2.5-5 2.5-5 1.1-5 2.5" />
    </svg>
  ),
  soporte: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v3a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Zm16 0v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z" />
      <path d="M18 18a3 3 0 0 1-3 3h-3" />
    </svg>
  ),
};

const SELLOS: Sello[] = [
  {
    titulo: "Verificación presencial",
    descripcion:
      "Inspeccionamos cada pensión antes de publicarla: fotos reales, condiciones confirmadas y anfitriones validados.",
    icono: iconos.verificacion,
  },
  {
    titulo: "Reserva directa, sin intermediarios",
    descripcion:
      "Hablas directo con el anfitrión por WhatsApp. Sin comisiones ocultas ni terceros en el camino.",
    icono: iconos.directo,
  },
  {
    titulo: "Precios mensuales claros",
    descripcion:
      "Todo en pesos colombianos, sin letra pequeña: sabes exactamente qué incluye tu mes y qué no.",
    icono: iconos.precio,
  },
  {
    titulo: "Soporte para estudiantes y padres",
    descripcion:
      "Te acompañamos en la mudanza y resolvemos dudas antes y después de reservar. Tranquilidad para toda la familia.",
    icono: iconos.soporte,
  },
];

/** Banda de 4 sellos de confianza (Agente 3 — CRO). Ancla #confianza. */
export default function SellosConfianza() {
  return (
    <section
      id="confianza"
      aria-labelledby="confianza-titulo"
      className="border-b border-neutro-200 bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
        <h2
          id="confianza-titulo"
          className="text-center font-display text-xl font-extrabold text-neutro-800 md:text-2xl"
        >
          Por qué familias y estudiantes eligen Pensiones Unimagdalena
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SELLOS.map((s) => (
            <li
              key={s.titulo}
              className="flex flex-col items-start gap-3 rounded-2xl bg-neutro-50 p-5 ring-1 ring-neutro-200"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
                {s.icono}
              </span>
              <h3 className="font-display text-[15px] font-bold leading-snug text-neutro-800">
                {s.titulo}
              </h3>
              <p className="text-sm leading-relaxed text-neutro-600">{s.descripcion}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
