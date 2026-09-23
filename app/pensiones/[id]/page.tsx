import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPensionPorId, obtenerPensiones, obtenerPensionesReales } from "@/lib/datos";
import { galeriaDe, imagenPrincipal, precioReservable } from "@/lib/pension";
import Carrusel from "@/components/Carrusel";
import SelloVerificado from "@/components/SelloVerificado";
import Estrellas from "@/components/Estrellas";
import DetallePension from "@/components/DetallePension";
import BotonFavorito from "@/components/BotonFavorito";
import FotoMarco from "@/components/FotoMarco";
import MapaUbicacion from "@/components/MapaUbicacion";
import Footer from "@/components/Footer";
import { SITIO_URL } from "@/lib/sitio";
import { serializarJsonLd } from "@/lib/json-ld";
import { resumenesDeBarrio, slugDeBarrio } from "@/lib/barrios";
import { MIGA_INICIO, jsonLdMigas, type Miga } from "@/lib/migas";
import Migas from "@/components/Migas";

interface Props {
  /**
   * Next 14 entrega `params` como objeto; Next 15 lo entrega como Promise.
   * `await params` funciona en ambas versiones, así que se tipa la Promise para
   * que la futura actualización de Next no rompa la ruta en silencio.
   */
  params: Promise<{ id: string }>;
}

/** El catálogo se revalida cada 60 s: las publicaciones nuevas aparecen solas. */
export const revalidate = 60;

/**
 * Se prerenderiza la **dirección legible** de cada anuncio, no su identificador
 * interno: es la dirección canónica, la que se comparte y la que se anuncia en el
 * `sitemap.xml`. Si aquí se devolviera el UUID, el build generaría páginas en una
 * dirección que ahora redirige, y la dirección buena quedaría sin prerenderizar.
 */
export async function generateStaticParams() {
  const pensiones = await obtenerPensiones();
  return pensiones.map((pension) => ({ id: pension.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pension = await obtenerPensionPorId(id);

  /**
   * Un id inexistente —o una publicación retirada, que la RLS no devuelve al
   * público— debe responder **404**, no un 200 que renderiza «no encontrada»
   * (lo que los buscadores tratan como soft 404 y penalizan en un sitemap).
   *
   * Resolverlo aquí y no solo en el cuerpo de la página es lo que garantiza el
   * código de estado: el segmento tiene una frontera de streaming
   * (`loading.tsx`), y cuando la página llama a `notFound()` la cabecera ya se
   * envió. La metadata, en cambio, se resuelve antes de escribirla.
   */
  if (!pension) notFound();

  const titulo = `${pension.titulo} — pensión en ${pension.barrio}, Santa Marta`;
  const descripcion = `${pension.titulo} en ${pension.barrio}, Santa Marta. A ${pension.distancia_a_pie_minutos} minutos caminando de Unimagdalena. Puntaje del equipo: ${pension.calificacion.toFixed(1)}/5. Reserva directa por WhatsApp.`;
  const principal = imagenPrincipal(pension);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/pensiones/${pension.slug}` },
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: `${SITIO_URL}/pensiones/${pension.slug}`,
      siteName: "Pensiones Unimagdalena",
      title: titulo,
      description: descripcion,
      images: [{ url: principal, width: 900, height: 600, alt: pension.titulo }],
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [principal],
    },
  };
}

export default async function DetallePensionPage({ params }: Props) {
  const { id } = await params;
  const pension = await obtenerPensionPorId(id);
  if (!pension) notFound();

  /**
   * La redirección del enlace antiguo (UUID → dirección legible) vive en
   * `middleware.ts`, que sí puede fijar el código 308 antes de que se envíe la
   * cabecera. Aquí no se repite: hacerlo en el render perdería el código de
   * estado por la frontera de streaming y serviría el mismo anuncio en dos
   * direcciones (contenido duplicado para los buscadores).
   */
  const principal = imagenPrincipal(pension);
  const galeria = galeriaDe(pension);
  /**
   * Precio anunciable en los datos estructurados: `null` si el anfitrión marcó
   * todas sus habitaciones como ocupadas. Antes se usaba `precioDesde()`, que en
   * ese caso devuelve el último `precio_mensual` conservado por la base y
   * publicaba un `priceRange` que ya no se puede reservar.
   */
  const precioParaReservar = precioReservable(pension);

  /**
   * La miga de pan incluye el barrio **solo si esa página existe**. El barrio lo
   * escribe el anfitrión a mano y las páginas de barrio se construyen únicamente
   * con publicaciones reales; con la demostración encendida hay anuncios de
   * ejemplo cuyo barrio no tiene página. Enlazar desde una ficha indexada a una
   * ruta que responde 404 sería peor que no ofrecer el enlace.
   */
  const slugsDeBarrio = new Set(
    resumenesDeBarrio(await obtenerPensionesReales()).map((resumen) => resumen.slug),
  );
  const slugBarrio = slugDeBarrio(pension.barrio ?? "");

  const migas: Miga[] = [
    MIGA_INICIO,
    ...(slugBarrio && slugsDeBarrio.has(slugBarrio)
      ? [{ nombre: pension.barrio, ruta: `/barrios/${slugBarrio}` }]
      : []),
    { nombre: pension.titulo, ruta: `/pensiones/${pension.slug}` },
  ];

  const jsonLdPension = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: pension.titulo,
    description:
      pension.descripcion ||
      `${pension.titulo} en ${pension.barrio}, Santa Marta. A ${pension.distancia_a_pie_minutos} minutos caminando de la Universidad del Magdalena.`,
    url: `${SITIO_URL}/pensiones/${pension.slug}`,
    image: galeria,
    address: {
      "@type": "PostalAddress",
      // El barrio va en la dirección; la localidad correcta es la ciudad.
      streetAddress: pension.direccion
        ? `${pension.direccion}${pension.barrio ? `, ${pension.barrio}` : ""}`
        : pension.barrio || undefined,
      addressLocality: "Santa Marta",
      addressRegion: "Magdalena",
      addressCountry: "CO",
    },
    // `geo` solo se declara con coordenadas REALES del alojamiento. Antes se
    // enviaban las coordenadas del centro de Santa Marta, lo que era impreciso.
    ...(pension.latitud != null && pension.longitud != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: pension.latitud,
            longitude: pension.longitud,
          },
        }
      : {}),
    // Precio verificable (el más bajo de sus habitaciones disponibles). Sin
    // ninguna habitación libre se omite a propósito: los buscadores leen este
    // campo y declarar un precio no reservable es peor que no declararlo.
    ...(precioParaReservar !== null ? { priceRange: `${precioParaReservar} COP` } : {}),

    // NOTA (auditoría): NO se emite `aggregateRating`. Todavía no existen
    // reseñas reales de usuarios y declarar un `reviewCount` calculado
    // (antes: `Math.round(calificacion * 18)`) viola las Structured Data
    // Guidelines de Google y puede acarrear una penalización manual del
    // dominio completo. Cuando haya reseñas verificables, se añadirá aquí
    // con datos reales.
    amenityFeature: pension.servicios.map((servicio) => ({
      "@type": "LocationFeatureSpecification",
      name: servicio,
    })),
  };

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl">
        <div className="relative h-72 w-full md:h-96">
          {/* Las fotos verticales (lo más común desde el celular) se ven
              completas sobre un fondo difuminado, en lugar de recortadas. */}
          <FotoMarco
            src={principal}
            alt={`Fachada o sala principal de ${pension.titulo}`}
            sizes="100vw"
            priority
          />
          <Link
            href="/#resultados"
            className="absolute left-4 top-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-white/95 px-4 text-sm font-bold text-neutro-800 shadow-md backdrop-blur transition hover:bg-white"
          >
            <span aria-hidden="true">←</span> Volver
          </Link>
        </div>

        <div className="px-4 py-6 md:px-0">
          <Migas migas={migas} />

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutro-500">
            {pension.barrio || "Santa Marta"} · Santa Marta
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold text-neutro-800 md:text-3xl">
            {pension.titulo}
            {pension.verificado && <SelloVerificado tamano="md" />}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-2">
              <Estrellas calificacion={pension.calificacion} tamano="md" />
              <span className="text-sm font-semibold text-neutro-700">
                {pension.calificacion.toFixed(1)}
              </span>
              <span className="text-xs text-neutro-500">Puntaje del equipo</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm text-neutro-600">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-primary-600" aria-hidden="true">
                <circle cx="10" cy="10" r="7.25" />
                <path d="M10 5.5V10l3 1.75" strokeLinecap="round" />
              </svg>
              {pension.distancia_a_pie_minutos} min a pie de Unimagdalena
            </span>
          </div>

          {pension.verificado && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-800 ring-1 ring-primary-100">
              ✓ Verificada por el equipo (inspección presencial)
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <BotonFavorito pensionId={pension.id} titulo={pension.titulo} variante="detalle" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Mira esta pensión cerca de Unimagdalena: ${pension.titulo} (${pension.barrio}) — ${SITIO_URL}/pensiones/${pension.slug}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutro-300 bg-white px-4 text-sm font-bold text-neutro-700 transition hover:bg-neutro-100"
            >
              Compartir por WhatsApp
            </a>
          </div>

          {pension.descripcion && (
            <section className="mt-6" aria-label="Descripción del alojamiento">
              <h2 className="font-display text-lg font-bold text-neutro-800">
                Sobre este alojamiento
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutro-600">
                {pension.descripcion}
              </p>
            </section>
          )}

          <section className="mt-6" aria-label="Galería de fotos">
            <Carrusel
              imagenes={galeria}
              altBase={pension.titulo}
              className="h-48 w-full overflow-hidden rounded-2xl md:h-64"
            />
          </section>

          {pension.servicios.length > 0 && (
            <section className="mt-8" aria-label="Servicios incluidos">
              <h2 className="font-display text-lg font-bold text-neutro-800">
                Servicios incluidos
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {pension.servicios.map((servicio) => (
                  <li
                    key={servicio}
                    className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-neutro-700 ring-1 ring-neutro-200"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                    {servicio}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pension.normas.length > 0 && (
            <section className="mt-8" aria-label="Normas de la casa">
              <h2 className="font-display text-lg font-bold text-neutro-800">
                Normas de la casa
              </h2>
              <ul className="mt-3 space-y-2">
                {pension.normas.map((norma) => (
                  <li key={norma} className="flex items-center gap-2 text-sm text-neutro-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-400" aria-hidden="true" />
                    {norma}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8" aria-label="Ubicación y distancia al campus">
            <h2 className="font-display text-lg font-bold text-neutro-800">
              Ubicación y distancia al campus
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-neutro-500">
              {pension.latitud != null && pension.longitud != null
                ? "Pin exacto indicado por el anfitrión, con la línea de referencia al campus."
                : `El círculo marca la zona a unos ${pension.distancia_a_pie_minutos} minutos a pie del campus (≈ ${pension.distancia_a_pie_minutos * 75} m). La ubicación es aproximada a nivel de barrio: confirma la dirección exacta con el anfitrión por WhatsApp.`}
            </p>
            <div className="mt-3">
              <MapaUbicacion
                titulo={pension.titulo}
                barrio={pension.barrio}
                minutos={pension.distancia_a_pie_minutos}
                latitud={pension.latitud}
                longitud={pension.longitud}
              />
            </div>
          </section>

          <div className="mt-10">
            <DetallePension pension={pension} />
          </div>
        </div>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdPension) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdMigas(migas)) }}
      />
    </>
  );
}
