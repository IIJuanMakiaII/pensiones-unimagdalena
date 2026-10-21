import Link from "next/link";
import {
  WHATSAPP_DISPONIBLE,
  atributosDeContacto,
  enlaceWhatsAppPlataforma,
} from "@/lib/formato";
import { DEMO_HABILITADA } from "@/lib/sitio";
import LogoNido from "@/components/LogoNido";

/**
 * Footer: marca, acceso a «cómo verificamos», contacto y avisos legales.
 *
 * Ya no lleva el bloque «Sellos de confianza» (tarea #57): repetía, junto al pie,
 * la misma lista que la banda de confianza de la portada. Ahora **enlaza** a la
 * sección que lo explica, que es útil desde cualquier página sin repetir la
 * promesa en todas ellas.
 */
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-neutro-200 bg-neutro-100 text-neutro-600">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <LogoNido className="h-8" />
            <p className="mt-2 text-base leading-relaxed text-neutro-600">
              Pensiones y habitaciones para estudiantes de la Universidad del
              Magdalena, en Santa Marta.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutro-800">
              Confianza
            </h2>
            {/* Enlace, no promesa: la comprobación se explica una sola vez, en la
                portada, y esto solo lleva hasta ella desde cualquier página. */}
            <p className="mt-3 text-sm">
              <Link
                href="/#como-funciona"
                className="font-normal text-neutro-600 underline-offset-2 hover:text-neutro-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                Cómo verificamos cada anuncio
              </Link>
            </p>
            {/* La segunda mitad de la misma pregunta. «Cómo verificamos» dice qué
                se comprueba; esto dice quién lo comprueba. El texto evita a
                propósito las palabras que la prueba del mensaje único reserva
                para la sección de la portada (ver `lista-espera.prueba.ts`). */}
            <p className="mt-2 text-sm">
              <Link
                href="/quienes-somos"
                className="font-normal text-neutro-600 underline-offset-2 hover:text-neutro-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                Quiénes somos
              </Link>
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutro-800">
              Contacto
            </h2>
            <p className="mt-3 text-sm text-neutro-600">
              ¿Tienes una pensión o buscas asesoría?
            </p>
            {/*
              Este enlace componía su propio `wa.me` a mano. Con el número sin
              configurar, aquella copia caía al número de ejemplo y mandaba al
              vacío: el mismo fallo que el resto del sitio evita. Ahora sale de
              la fuente única, y con el canal caído lleva al formulario.
            */}
            {/* El enlace se pide a `lib/formato.ts` en lugar de componerlo aquí: el
                pie construía su propio `wa.me` y ese es, literalmente, el camino por
                el que el número de ejemplo llegó a estar vivo en dos sitios a la vez.
                Además, si el canal de WhatsApp no está disponible, este helper ya
                devuelve el formulario de respaldo. */}
            <a
              href={enlaceWhatsAppPlataforma()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-airbnb-rausch-hover px-6 text-sm font-semibold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
            >
              {WHATSAPP_DISPONIBLE ? "Escríbenos por WhatsApp" : "Escríbenos"}
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

        {/* El aviso de demostración solo tiene sentido mientras la demostración
            está disponible. Con el catálogo real contradecía lo que el visitante
            veía. La variable se decide al compilar, así que esto es correcto sin
            depender de qué haya configurado en el despliegue. */}
        <p className="mt-4 text-xs text-neutro-600">
          © {new Date().getFullYear()} Nido · Santa Marta - Magdalena - Colombia.
          {DEMO_HABILITADA && " Datos de demostración para el proyecto académico."}
        </p>
      </div>
    </footer>
  );
}
