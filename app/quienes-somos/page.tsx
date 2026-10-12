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
 * DE DÓNDE SALE EL TEXTO
 * ----------------------
 * El texto es del fundador, literal, en su orden y en su voz: lo reescribió él y
 * este archivo no lo mejora, no lo resume y no lo reordena. La única corrección
 * es una errata suya —«7 dias» → «7 días»—, y está declarada.
 *
 * En el borrador anterior había cuatro huecos marcados para completar. Dos de
 * ellos ya están escritos por su autor y viven aquí: por qué lo hace —la estafa a
 * un amigo cercano— y qué pasa si algo sale mal. Los otros dos siguen sin
 * rellenar, y siguen sin rellenarse: publicar una promesa que nadie ha confirmado
 * es peor que no publicarla.
 *
 * LA MAQUETACIÓN QUE PIDIÓ
 * ------------------------
 * «Por qué lo hago» va **a la derecha de la foto**, no debajo. Se resuelve con una
 * fila que en móvil se apila en el orden natural de lectura —foto arriba, texto
 * abajo— y a partir de 768 px pone la foto a la izquierda y el bloque a su derecha.
 *
 * LO QUE ESTA PÁGINA **NO** HACE
 * ------------------------------
 * No lee el catálogo. Por eso no entra en `RUTAS_DEL_CATALOGO` y no participa en
 * la invalidación de caché: es contenido permanente, no una vista del inventario.
 * Y por eso mismo no puede quedarse desactualizada cuando cambian las pensiones.
 */

const MIGAS: Miga[] = [MIGA_INICIO, { nombre: "Quiénes somos", ruta: "/quienes-somos" }];

/** Las condiciones de uso. Existe (`app/legal/condiciones`) y la promesa del reembolso vive ahí. */
const RUTA_CONDICIONES = "/legal/condiciones";

/** El mismo mensaje que llevan los CTA de esta página: quien escribe no tiene que explicarse. */
const MENSAJE_WHATSAPP =
  "Hola, quiero información sobre una pensión cerca de la Universidad del Magdalena.";

export const metadata: Metadata = {
  title: "Quiénes somos: la persona detrás de Nido",
  description:
    "Nido nació de un problema que conocemos los estudiantes que venimos de otras ciudades. Conoce a quién le escribes y quién visita cada pensión antes de publicarla.",
  alternates: { canonical: `${SITIO_URL}/quienes-somos` },
};

/**
 * Los cuatro pasos, en primera persona: lo que hace el fundador, no lo que hace
 * el sitio. Antes eran tres y contaban el proceso de publicación; estos cuatro son
 * los del texto nuevo y cuentan el recorrido completo hasta la reserva.
 */
const PASOS = [
  {
    titulo: "Buscas por barrio y precio",
    detalle: "Filtras y ves a cuántos minutos a pie queda del campus.",
  },
  {
    titulo: "Me escribes por WhatsApp",
    detalle:
      "Me cuentas qué buscas. Hablo yo con el propietario para confirmar qué hay disponible y conocerlo.",
  },
  {
    titulo: "Visito y sello",
    detalle:
      "Voy en persona al inmueble. Compruebo que quien publica es el propietario o tiene su autorización, y que todo coincide con las fotos y con lo que me dijo. Si es así, el anuncio recibe el sello «Verificado por Nido ✓» con su fecha.",
  },
  {
    titulo: "Reservas el primer mes",
    detalle:
      "Pagas la reserva con mi acompañamiento, y el saldo restante se lo entregas al propietario al llegar.",
  },
];

/**
 * El canal, dentro de una frase.
 *
 * El texto nuevo invita a escribir dos veces, y una invitación que no lleva a
 * ningún sitio promete de más. Se usa la misma compuerta que el resto del sitio
 * —la que decide `WHATSAPP_DISPONIBLE`— para no nombrar un canal que pueda estar
 * caído: si no está, se ofrece el formulario.
 */
function EnlaceCanal() {
  const clase = "font-semibold text-primary-700 underline underline-offset-2";

  if (!WHATSAPP_DISPONIBLE) {
    return (
      <Link href={RUTA_CONTACTO} className={clase}>
        Escríbeme
      </Link>
    );
  }

  return (
    <a
      href={enlaceWhatsAppPlataforma(MENSAJE_WHATSAPP)}
      target="_blank"
      rel="noopener noreferrer"
      className={clase}
    >
      Escríbeme por WhatsApp
    </a>
  );
}

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
              href={enlaceWhatsAppPlataforma(MENSAJE_WHATSAPP)}
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

        {/* Foto y «Por qué lo hago» en la misma fila: en móvil se apila (foto
            arriba), y a partir de 768 px el bloque queda a la derecha, que es la
            maquetación que pidió el fundador. El retrato es vertical 4:5 y se sirve
            desde el dominio (nunca de un tercero), con `fill` sobre un marco de
            relación fija para que la reserva de espacio no dependa de que la imagen
            cargue. */}
        <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          <div className="relative aspect-[4/5] w-full max-w-[18rem] shrink-0 overflow-hidden rounded-2xl bg-neutro-100 ring-1 ring-neutro-200">
            <Image
              src={FUNDADOR.foto}
              alt={`${FUNDADOR.nombre}, fundador de Nido`}
              fill
              sizes="(max-width: 768px) 100vw, 288px"
              className="object-cover"
            />
          </div>

          <section aria-labelledby="titulo-por-que-lo-hago" className="md:min-w-0 md:flex-1">
            <h2
              id="titulo-por-que-lo-hago"
              className="font-display text-lg font-bold text-neutro-800"
            >
              Por qué lo hago
            </h2>
            <p className="mt-3 text-base leading-relaxed text-neutro-700">
              A un amigo cercano lo estafaron buscando pensión en Santa Marta: pagó por una
              habitación que no era como se la habían mostrado. Ver lo que le pasó me hizo entender
              que el problema es real y que le puede pasar a cualquier estudiante que llega de otra
              ciudad.
            </p>
            <p className="mt-3 text-base leading-relaxed text-neutro-700">
              Mi meta es sencilla: que los estudiantes encuentren una pensión de forma segura, y que
              sus familias puedan decidir con tranquilidad aunque estén lejos.
            </p>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-neutro-800">Cómo funciona Nido</h2>
          <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <p className="mt-4 text-base leading-relaxed text-neutro-700">
            Si te interesa un anuncio que aún no tiene sello, no pasa nada: me escribes, lo visito
            primero y te aviso. Solo se puede reservar cuando ya lo verifiqué. Te respondo en
            máximo 24h y hago la visita en 7 días.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-neutro-200 bg-white p-5">
          <h2 className="font-display text-lg font-bold text-neutro-800">Si algo sale mal</h2>
          <p className="mt-2 text-base leading-relaxed text-neutro-700">
            <EnlaceCanal />{" "}
            y te respondo en máximo 24h. Si el propietario cancela o la habitación no es como la
            mostré, te devuelvo tu reserva completa.{" "}
            <Link
              href={RUTA_CONDICIONES}
              className="font-semibold text-primary-700 underline underline-offset-2"
            >
              Consulta la política de reembolso completa.
            </Link>
          </p>
        </section>

        <section className="mt-10 rounded-2xl bg-primary-50 p-5">
          <h2 className="font-display text-base font-bold text-primary-900">Quién está detrás</h2>
          <p className="mt-2 text-base leading-relaxed text-primary-900/80">
            Nido es un proyecto que estoy arrancando como estudiante. Yo diseñé y programé la
            plataforma, y yo visito cada inmueble que lleva el sello. Si tienes dudas, hablas
            directamente conmigo.
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
            ¿Buscas pensión o tienes una para publicar? Escríbeme por{" "}
            {WHATSAPP_DISPONIBLE ? (
              <a
                href={enlaceWhatsAppPlataforma(MENSAJE_WHATSAPP)}
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
                el formulario de contacto
              </Link>
            )}{" "}
            o a{" "}
            <a
              href={`mailto:${FUNDADOR.correo}`}
              className="font-semibold text-primary-700 underline underline-offset-2"
            >
              {FUNDADOR.correo}
            </a>
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
