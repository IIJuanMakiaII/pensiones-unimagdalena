import type { Metadata } from "next";
import Link from "next/link";
import { SITIO_URL } from "@/lib/sitio";
import { serializarJsonLd } from "@/lib/json-ld";
import { MIGA_INICIO, jsonLdMigas, type Miga } from "@/lib/migas";
import Migas from "@/components/Migas";
import Footer from "@/components/Footer";

/**
 * Guia informativa: como elegir una pension cerca de la Universidad del
 * Magdalena.
 *
 * Reglas de la casa para esta pagina:
 *
 * - **Nada inventado.** No hay cifras de mercado, ni rankings, ni estadisticas:
 *   solo lo que una familia puede comprobar ella misma en una visita. Un dato
 *   inventado aqui contaminaria justo lo que la guia viene a construir.
 * - **No define que significa "verificada".** Esa frase es una promesa publica del
 *   sitio y la decision de como se sostiene esta pendiente del fundador, asi que
 *   la guia no la interpreta ni la usa como argumento de venta.
 * - **Las preguntas frecuentes que se declaran son las que se ven.** Los datos
 *   estructurados se generan de la misma lista que se pinta, para que no puedan
 *   desincronizarse.
 */

interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

const PREGUNTAS: PreguntaFrecuente[] = [
  {
    pregunta: "¿Qué debería revisar en una visita antes de pagar?",
    respuesta:
      "Que la habitación sea la de las fotos, cuántas personas comparten el baño y la cocina, si el agua y la energía están incluidas en el precio y quién responde por los daños. Pida ver el contrato antes de transferir y pague únicamente contra un documento firmado.",
  },
  {
    pregunta: "¿La reserva y el pago se hacen en este sitio?",
    respuesta:
      "No. Este sitio es una vitrina: muestra las publicaciones y le pone en contacto con el anfitrión por WhatsApp. La reserva, el contrato y el pago los acuerda directamente con él, fuera de la plataforma.",
  },
  {
    pregunta: "¿Cómo se calcula el precio que aparece en una publicación?",
    respuesta:
      "El precio es el que declara el anfitrión para cada tipo de habitación y se muestra en pesos colombianos al mes. Cuando una habitación está marcada como ocupada, deja de contarse como reservable.",
  },
  {
    pregunta: "¿La distancia a pie la mide la plataforma?",
    respuesta:
      "Es el tiempo que declara cada anfitrión, no una medición hecha por la plataforma. En la ficha hay un mapa con la ubicación declarada: conviene comprobar a pie el recorrido real al campus antes de decidir.",
  },
  {
    pregunta: "¿Qué pasa si el alojamiento no corresponde a lo publicado?",
    respuesta:
      "Avise por el mismo contacto con el que reservó y, si el anuncio incumple lo que promete, escríbanos para revisarlo. No firme ni pague nada mientras encuentre diferencias que no se hayan aclarado.",
  },
];

/**
 * Un escalon y no dos: la ruta «Guias» aun no existe como indice propio. Un nivel
 * intermedio que apunte a esta misma pagina seria una miga de pan que no lleva a
 * ningun sitio.
 */
const MIGAS: Miga[] = [
  MIGA_INICIO,
  { nombre: "Cómo elegir pensión", ruta: "/guias/como-elegir-pension-unimagdalena" },
];

export const metadata: Metadata = {
  title: "Cómo elegir pensión cerca de Unimagdalena: qué revisar antes de pagar",
  description:
    "Lista de comprobación para elegir pensión o habitación en Santa Marta: visita presencial, servicios incluidos, normas, distancia al campus y quién responde el contrato.",
  alternates: { canonical: `${SITIO_URL}/guias/como-elegir-pension-unimagdalena` },
};

/** Preguntas y respuestas para una visita, agrupadas por momento. */
const LISTA = [
  {
    titulo: "Antes de ir",
    puntos: [
      "Escriba al anfitrión por WhatsApp y confirme que la habitación que le interesa sigue libre.",
      "Pregunte cuántas personas comparten baño y cocina: es lo que más cambia la experiencia diaria.",
      "Pida la dirección exacta y compruebe en un mapa cuánto camina de verdad al campus.",
    ],
  },
  {
    titulo: "En la visita",
    puntos: [
      "Recorra la habitación y el resto de la casa; compare con las fotos de la publicación.",
      "Mire la presión del agua, si hay ventana y ventilación, y cómo se ve el barrio cuando oscurece.",
      "Pregunte por el ruido: horas de estudio, visitas, música y quién más vive ahí.",
      "Confirme qué está incluido en el precio y qué se cobra aparte.",
    ],
  },
  {
    titulo: "Antes de pagar",
    puntos: [
      "Pida ver el contrato por escrito antes de transferir cualquier suma.",
      "Aclare quién responde por daños, con cuánta anticipación debe avisar si se va, y cómo se devuelve el depósito.",
      "No entregue dinero sin un documento firmado ni a alguien que no pueda demostrar que administra el alojamiento.",
    ],
  },
];

export default function PaginaGuia() {
  const jsonLdPreguntas = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.map((item) => ({
      "@type": "Question",
      name: item.pregunta,
      acceptedAnswer: { "@type": "Answer", text: item.respuesta },
    })),
  };

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-6">
        <Migas migas={MIGAS} />

        <h1 className="mt-2 font-display text-2xl font-extrabold text-neutro-800 md:text-3xl">
          Cómo elegir pensión cerca de Unimagdalena
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutro-600">
          Elegir dónde vivir el semestre se decide en una visita, no en una página web. Esto es lo
          que conviene preguntar y comprobar antes de firmar o transferir, en el orden en que
          ocurre.
        </p>

        {LISTA.map((bloque) => (
          <section key={bloque.titulo} className="mt-8">
            <h2 className="font-display text-lg font-bold text-neutro-800">{bloque.titulo}</h2>
            <ul className="mt-3 space-y-2">
              {bloque.puntos.map((punto) => (
                <li key={punto} className="flex gap-2 text-sm leading-relaxed text-neutro-700">
                  <span aria-hidden="true" className="text-primary-600">
                    ✓
                  </span>
                  <span>{punto}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-10" aria-label="Preguntas frecuentes">
          <h2 className="font-display text-lg font-bold text-neutro-800">Preguntas frecuentes</h2>
          <dl className="mt-3 space-y-4">
            {PREGUNTAS.map((item) => (
              <div key={item.pregunta} className="rounded-2xl border border-neutro-200 bg-white p-4">
                <dt className="font-semibold text-neutro-800">{item.pregunta}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-neutro-600">{item.respuesta}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 rounded-2xl bg-primary-50 p-4">
          <h2 className="font-display text-base font-bold text-primary-900">
            Siga buscando por barrio
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-primary-900/80">
            Cada barrio tiene su propia distancia al campus y su rango de precios. Puede verlos
            todos, con datos de las publicaciones actuales.
          </p>
          <p className="mt-3 flex flex-wrap gap-4 text-sm">
            <Link
              href="/barrios"
              className="font-bold text-primary-800 underline-offset-2 hover:underline"
            >
              Ver barrios cerca del campus
            </Link>
            <Link
              href="/#resultados"
              className="font-bold text-primary-800 underline-offset-2 hover:underline"
            >
              Ver el catálogo completo
            </Link>
          </p>
        </section>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdPreguntas) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdMigas(MIGAS)) }}
      />
    </>
  );
}
