import { WHATSAPP_NUMERO } from "@/lib/formato";

/** Footer de confianza: sellos, contacto WhatsApp y aviso legal (§4.1.5). */
export default function Footer() {
  return (
    <footer className="mt-12 bg-secondary-700 text-secondary-100">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Pensiones Unimagdalena
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-200">
              Marketplace de pensiones y habitaciones para estudiantes de la
              Universidad del Magdalena, en Santa Marta. Verificamos cada
              propiedad antes de publicarla.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              Sellos de confianza
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Dot /> Verificación presencial de cada pensión
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Reserva directa, sin intermediarios
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Precios mensuales claros en COP
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Atención al estudiante y a sus padres
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              Contacto
            </h2>
            <p className="mt-3 text-sm text-secondary-200">
              ¿Tienes una pensión o buscas asesoría?
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                "Hola, quiero información sobre el Marketplace de Pensiones Unimagdalena."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-whatsapp-deep px-5 text-sm font-bold text-white transition hover:bg-whatsapp-dark"
            >
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>

        <p className="mt-8 border-t border-white/10 pt-5 text-xs text-secondary-300">
          © {new Date().getFullYear()} Pensiones Unimagdalena · Santa Marta,
          Magdalena, Colombia. Datos de demostración para el proyecto académico.
        </p>
      </div>
    </footer>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" aria-hidden="true" />;
}
