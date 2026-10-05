import Link from "next/link";
import { WHATSAPP_NUMERO } from "@/lib/formato";
import LogoNido from "@/components/LogoNido";

/** Footer de confianza: sellos, contacto WhatsApp y aviso legal (§4.1.5). */
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-neutro-200 bg-neutro-100 text-neutro-600">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <LogoNido className="h-8" />
            <p className="mt-2 text-sm leading-relaxed text-neutro-600">
              Marketplace de pensiones y habitaciones para estudiantes de la
              Universidad del Magdalena, en Santa Marta. Verificamos cada
              propiedad antes de publicarla.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutro-800">
              Sellos de confianza
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Dot /> Verificación presencial de cada pensión
              </li>
              <li className="flex items-center gap-2">
                <Dot /> Cerramos contigo la reserva del primer mes
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
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutro-800">
              Contacto
            </h2>
            <p className="mt-3 text-sm text-neutro-600">
              ¿Tienes una pensión o buscas asesoría?
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
                "Hola, quiero información sobre Nido."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-airbnb-rausch px-6 text-sm font-semibold text-white transition hover:bg-airbnb-rausch-hover"
            >
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>

        {/* Los textos legales tienen que ser alcanzables desde cualquier vista:
            publicar una autorización que no se puede leer no es una autorización. */}
        <nav aria-label="Textos legales" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-neutro-200 pt-5 text-sm">
          <Link
            href="/legal/privacidad"
            className="font-normal text-neutro-600 underline-offset-2 hover:text-neutro-800 hover:underline"
          >
            Aviso de privacidad
          </Link>
          <Link
            href="/legal/condiciones"
            className="font-normal text-neutro-600 underline-offset-2 hover:text-neutro-800 hover:underline"
          >
            Condiciones de uso
          </Link>
        </nav>

        <p className="mt-4 text-xs text-neutro-600">
          © {new Date().getFullYear()} Nido · Santa Marta,
          Magdalena, Colombia. Datos de demostración para el proyecto académico.
        </p>
      </div>
    </footer>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-confianza-success" aria-hidden="true" />;
}
