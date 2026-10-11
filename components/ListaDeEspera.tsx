import Link from "next/link";
import { enlaceWhatsAppPlataforma } from "@/lib/formato";
import { MENSAJE_LISTA_ESPERA } from "@/lib/lista-espera";

/**
 * Estado de la portada cuando todavía no hay inventario (tarea #57).
 *
 * Sustituye a la parrilla vacía del catálogo, que pedía al propietario que
 * publicara justo donde el estudiante esperaba ver habitaciones. Aquí el visitante
 * tiene una salida: dejar su contacto y una vuelta para el propietario.
 *
 * Dos cosas que este bloque **tiene** que sostener, y que no son cosmética:
 *
 *   1. El `<main id="resultados">`. Lo aportaba el catálogo, así que sin el
 *      catálogo la portada se quedaba sin landmark principal y el enlace «Saltar
 *      al contenido» —`app/layout.tsx`— no llevaba a ningún sitio. El ancla del
 *      botón del hero apunta al mismo id.
 *   2. La puerta única del contacto. El enlace se construye con
 *      `enlaceWhatsAppPlataforma`, no escribiendo un `wa.me` a mano: esa es la
 *      forma en que el número de ejemplo llegó a vivir en dos sitios a la vez, y
 *      ese helper ya decide solo si el canal de hoy es WhatsApp o el formulario de
 *      respaldo.
 *
 * Lo que **no** hace: repetir la promesa de verificación. Esa vive una sola vez,
 * en `components/ComoFunciona.tsx`, justo arriba. Aquí no se afirma nada sobre
 * ninguna visita porque no hay ningún anuncio que mostrar.
 */
export default function ListaDeEspera() {
  return (
    <main id="resultados" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <section
        aria-labelledby="lista-espera-titulo"
        className="rounded-2xl border border-dashed border-neutro-300 bg-white px-6 py-12 text-center"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </span>

        <h2
          id="lista-espera-titulo"
          className="mt-4 font-display text-lg font-bold text-neutro-800"
        >
          Todavía no hay pensiones publicadas
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-base leading-relaxed text-neutro-600">
          Estamos verificando los primeros inmuebles cerca de la Universidad del Magdalena.
          Déjanos tu WhatsApp y te avisamos en cuanto haya habitaciones: preferimos no
          publicar anuncios que no hayamos visitado.
        </p>

        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-base leading-relaxed text-neutro-600">
          <li className="flex gap-2">
            <Punto /> Te escribimos en cuanto haya habitaciones publicadas.
          </li>
          <li className="flex gap-2">
            <Punto /> Cada anuncio dirá el barrio, los minutos a pie del campus y el precio
            mensual en pesos.
          </li>
          <li className="flex gap-2">
            <Punto /> Te acompañamos en la reserva del primer mes hasta que estés dentro.
          </li>
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={enlaceWhatsAppPlataforma(MENSAJE_LISTA_ESPERA)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-airbnb-rausch-hover px-6 text-base font-semibold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            Avísame por WhatsApp
          </a>
          {/* La vuelta del propietario. Conserva el nombre que ya usa el catálogo
              («Publicar mi pensión») para que las dos portadas hablen igual: quien
              ya conoce el sitio no tiene que reaprender el botón. */}
          <Link
            href="/publicar"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-primary-600 bg-white px-6 text-base font-bold text-primary-700 transition hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Publicar mi pensión
          </Link>
        </div>

        <p className="mt-4 text-sm text-neutro-600">
          ¿Tienes una pensión o habitación? Publícala y aparecerá aquí para los estudiantes.
        </p>
      </section>
    </main>
  );
}

/** Viñeta decorativa: el `<li>` ya da la estructura, esto solo la dibuja. */
function Punto() {
  return (
    <span
      aria-hidden="true"
      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600"
    />
  );
}
