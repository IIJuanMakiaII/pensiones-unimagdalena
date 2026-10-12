import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SITIO_URL } from "@/lib/sitio";
import { FUNDADOR } from "@/lib/persona";
import { serializarJsonLd } from "@/lib/json-ld";
import { MIGA_INICIO, jsonLdMigas, type Miga } from "@/lib/migas";
import { RUTA_CONTACTO, WHATSAPP_DISPONIBLE, enlaceWhatsAppPlataforma } from "@/lib/formato";
import Migas from "@/components/Migas";
import Footer from "@/components/Footer";

/**
 * «Quiénes somos»: la persona que está detrás de Nido.
 *
 * POR QUÉ ESTA PÁGINA EXISTE
 * --------------------------
 * La portada explica *qué* hace Nido y *cómo* verifica cada anuncio, pero la
 * pregunta que sigue —«¿y quién está detrás de esto?»— no se respondía en
 * ninguna parte. En un marketplace donde un estudiante y su familia van a
 * transferir dinero a alguien que no conocen, la cara y el nombre de quien
 * responde no son un adorno: son el dato que permite decidir con tranquilidad
 * desde otra ciudad.
 *
 * DE DÓNDE SALE EL TEXTO, Y QUÉ SE DEJÓ FUERA A PROPÓSITO
 * ------------------------------------------------------
 * El texto es el del borrador del fundador, en su orden y en su voz. El borrador
 * traía cuatro huecos marcados para completar —una anécdota personal, qué pasa si
 * algo sale mal, la foto de una visita real y un Instagram— y **ninguno se ha
 * rellenado aquí**: publicar una promesa que nadie ha confirmado es peor que no
 * publicarla, y es exactamente lo que la auditoría externa señaló del sello. Los
 * huecos se añadirán cuando su autor los escriba.
 *
 * Los tres pasos de «Cómo funciona Nido» están contados en primera persona, que
 * es lo que los distingue de la sección de la portada: allí se describe el
 * recorrido del estudiante; aquí, lo que el fundador hace en persona.
 *
 * LO QUE ESTA PÁGINA **NO** HACE
 * ------------------------------
 * No lee el catálogo. Por eso no entra en `RUTAS_DEL_CATALOGO` y no participa en
 * la invalidación de caché: es contenido permanente, no una vista del inventario.
 * Y por eso mismo no puede quedarse desactualizada cuando cambian las pensiones.
 */

const MIGAS: Miga[] = [MIGA_INICIO, { nombre: "Quiénes somos", ruta: "/quienes-somos" }];

export const metadata: Metadata = {
  title: "Quiénes somos: la persona detrás de Nido",
  description:
    "Nido nació de un problema que conocemos los estudiantes que venimos de otras ciudades. Conoce a quién le escribes y quién visita cada pensión antes de publicarla.",
  alternates: { canonical: `${SITIO_URL}/quienes-somos` },
};

/** Los tres pasos, en primera persona: lo que hace el fundador, no lo que hace el sitio. */
const PASOS = [
  {
    titulo: "Visito la pensión",
    detalle:
      "Voy en persona a cada inmueble: reviso la habitación, los baños, el WiFi y los servicios, y tomo las fotos yo mismo para que lo que ves sea lo que hay.",
  },
  {
    titulo: "Publico con precios claros",
    detalle:
      "Solo se publica lo que pasó la visita. Cada anuncio muestra el precio mensual en pesos y qué incluye.",
  },
  {
    titulo: "Te acompaño en la reserva",
    detalle:
      "Me escribes por WhatsApp y hablo con el dueño, confirmo la habitación y te acompaño hasta que llegues.",
  },
];

export default function PaginaQuienesSomos() {
  const jsonLdPersona = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Quiénes somos",
    url: `${SITIO_URL}/quienes-somos`,
    mainEntity: {
      "@type": "Person",
      name: FUNDADOR.nombre,
      image: `${SITIO_URL}${FUNDADOR.foto}`,
      email: FUNDADOR.correo,
      sameAs: [FUNDADOR.linkedin],
      worksFor: { "@type": "Organization", name: "Nido", url: SITIO_URL },
    },
  };

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-6">
        <Migas migas={MIGAS} />

        <h1 className="mt-2 font-display text-2xl font-extrabold text-neutro-800 md:text-3xl">
          Soy {FUNDADOR.nombreDePila}, y creé Nido para que buscar pensión en Santa Marta no dé
          miedo
        </h1>

        <p className="mt-3 text-base leading-relaxed text-neutro-600">
          Estudio {FUNDADOR.estudio}. Nido nació de un problema que conocemos los estudiantes que
          venimos de otras ciudades: buscar dónde vivir entre grupos de WhatsApp, fotos que no
          coinciden y el miedo a que sea una estafa.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {WHATSAPP_DISPONIBLE ? (
            <a
              href={enlaceWhatsAppPlataforma(
                "Hola, quiero información sobre una pensión cerca de la Universidad del Magdalena."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-airbnb-rausch-hover px-6 text-sm font-semibold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
            >
              Escríbeme por WhatsApp
            </a>
          ) : (
            /* La misma regla que en el resto del sitio: si el canal no está
               disponible, no se dibuja un botón que lleva al vacío. */
            <Link
              href={RUTA_CONTACTO}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-airbnb-rausch-hover px-6 text-sm font-semibold text-white transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
            >
              Escríbeme
            </Link>
          )}

          <Link
            href="/#resultados"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-primary-600 px-6 text-sm font-bold text-primary-700 transition hover:bg-primary-50"
          >
            Ver habitaciones
          </Link>
        </div>

        {/* Retrato vertical 4:5. Se sirve desde el dominio (nunca de un tercero)
            y con `fill` sobre un marco de relación fija, para que la reserva de
            espacio no dependa de que la imagen cargue. */}
        <div className="relative mt-6 aspect-[4/5] w-full max-w-[18rem] overflow-hidden rounded-2xl bg-neutro-100 ring-1 ring-neutro-200">
          <Image
            src={FUNDADOR.foto}
            alt={`${FUNDADOR.nombre}, fundador de Nido`}
            fill
            sizes="(max-width: 768px) 100vw, 288px"
            className="object-cover"
          />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-neutro-800">Por qué lo hago</h2>
          <p className="mt-3 text-base leading-relaxed text-neutro-700">
            Mi meta es sencilla: que los estudiantes encuentren una pensión de forma segura, y que
            sus familias puedan decidir con tranquilidad aunque estén lejos.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-neutro-800">Cómo funciona Nido</h2>
          <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PASOS.map((paso, indice) => (
              <li
                key={paso.titulo}
                className="flex flex-col items-start gap-3 rounded-2xl bg-neutro-50 p-5 ring-1 ring-neutro-200"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 font-display text-lg font-extrabold text-white shadow-sm"
                >
                  {indice + 1}
                </span>
                <h3 className="font-display text-base font-bold leading-snug text-neutro-800">
                  {paso.titulo}
                </h3>
                <p className="text-base leading-relaxed text-neutro-600">{paso.detalle}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 rounded-2xl bg-primary-50 p-5">
          <h2 className="font-display text-base font-bold text-primary-900">Quién está detrás</h2>
          <p className="mt-2 text-base leading-relaxed text-primary-900/80">
            Nido es un proyecto que estoy arrancando como estudiante. Yo diseñé y programé la
            plataforma, y yo visito cada inmueble. Si tienes dudas, hablas directamente conmigo.
          </p>
          <p className="mt-3 text-sm">
            <a
              href={FUNDADOR.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary-800 underline-offset-2 hover:underline"
            >
              Mi perfil en LinkedIn
            </a>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-neutro-800">Hablemos</h2>
          <p className="mt-3 text-base leading-relaxed text-neutro-700">
            ¿Buscas pensión o tienes una para publicar? Escríbeme por el canal que prefieras.
          </p>

          <ul className="mt-4 space-y-2 text-base leading-relaxed">
            <li className="text-neutro-600">
              {WHATSAPP_DISPONIBLE ? (
                <a
                  href={enlaceWhatsAppPlataforma("Hola, quiero información sobre Nido.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary-700 underline underline-offset-2"
                >
                  WhatsApp
                </a>
              ) : (
                <Link
                  href={RUTA_CONTACTO}
                  className="font-semibold text-primary-700 underline underline-offset-2"
                >
                  El formulario de contacto
                </Link>
              )}
            </li>
            <li className="text-neutro-600">
              <a
                href={`mailto:${FUNDADOR.correo}`}
                className="font-semibold text-primary-700 underline underline-offset-2"
              >
                {FUNDADOR.correo}
              </a>
            </li>
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-neutro-200 bg-white p-5">
          <h2 className="font-display text-base font-bold text-neutro-800">
            Cómo verificamos cada anuncio
          </h2>
          <p className="mt-2 text-base leading-relaxed text-neutro-600">
            El sello «Verificado por Nido ✓» lo otorga el equipo desde el panel, y ningún
            anunciante puede ponérselo por su cuenta. Lo recibe un inmueble después de una visita
            en la que se comprueban las condiciones básicas y los servicios.
          </p>
          <p className="mt-3 text-sm">
            <Link
              href="/#como-funciona"
              className="font-bold text-primary-700 underline-offset-2 hover:underline"
            >
              Ver qué se comprueba en la visita
            </Link>
          </p>
        </section>

        <p className="mt-8 text-center text-sm">
          <Link href="/" className="font-bold text-primary-700 hover:underline">
            ← Volver al catálogo
          </Link>
        </p>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdPersona) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdMigas(MIGAS)) }}
      />
    </>
  );
}
