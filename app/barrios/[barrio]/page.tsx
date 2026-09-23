import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPensionesReales } from "@/lib/datos";
import { resumenesDeBarrio } from "@/lib/barrios";
import { formatearCOP } from "@/lib/formato";
import { SITIO_URL } from "@/lib/sitio";
import { serializarJsonLd } from "@/lib/json-ld";
import { MIGA_INICIO, jsonLdMigas, type Miga } from "@/lib/migas";
import { FILTROS_INICIALES } from "@/lib/filtros";
import CardPension from "@/components/CardPension";
import Migas from "@/components/Migas";
import Footer from "@/components/Footer";

interface Props {
  params: Promise<{ barrio: string }>;
}

export const revalidate = 3600;

/**
 * Se prerenderiza un barrio por cada barrio con publicaciones reales.
 *
 * Si la base no responde o no hay publicaciones, la lista sale vacia y la ruta
 * responde 404 en lugar de servir una pagina sin contenido. `dynamicParams` se
 * deja activado (valor por defecto): un barrio nuevo aparece sin recompilar.
 */
export async function generateStaticParams() {
  const resumenes = resumenesDeBarrio(await obtenerPensionesReales());
  return resumenes.map((resumen) => ({ barrio: resumen.slug }));
}

async function buscarResumen(slug: string) {
  const resumenes = resumenesDeBarrio(await obtenerPensionesReales());
  return resumenes.find((resumen) => resumen.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { barrio } = await params;
  const resumen = await buscarResumen(barrio);
  if (!resumen) return {};

  const partes = [
    resumen.pensiones.length === 1
      ? "1 pensión publicada"
      : `${resumen.pensiones.length} pensiones publicadas`,
  ];
  if (resumen.minutosMinimos !== null) {
    partes.push(`desde ${resumen.minutosMinimos} min a pie del campus`);
  }
  if (resumen.precioMinimo !== null) {
    partes.push(`desde ${formatearCOP(resumen.precioMinimo)}`);
  }

  return {
    title: `Pensiones y habitaciones en ${resumen.barrio}, Santa Marta`,
    description: `Habitaciones para estudiantes en ${resumen.barrio}, Santa Marta: ${partes.join(", ")}.`,
    alternates: { canonical: `${SITIO_URL}/barrios/${resumen.slug}` },
  };
}

export default async function PaginaBarrio({ params }: Props) {
  const { barrio } = await params;
  const resumen = await buscarResumen(barrio);
  if (!resumen) notFound();

  const { barrio: nombre, slug, pensiones, minutosMinimos, servicios, precioMinimo, precioMaximo } =
    resumen;

  const migas: Miga[] = [
    MIGA_INICIO,
    { nombre: "Barrios", ruta: "/barrios" },
    { nombre: nombre, ruta: `/barrios/${slug}` },
  ];

  const jsonLdListado = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Pensiones y habitaciones en ${nombre}`,
    numberOfItems: pensiones.length,
    itemListElement: pensiones.map((pension, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: pension.titulo,
      url: `${SITIO_URL}/pensiones/${pension.slug}`,
    })),
  };

  const rangoDePrecio =
    precioMinimo === null
      ? null
      : precioMinimo === precioMaximo
        ? formatearCOP(precioMinimo)
        : `${formatearCOP(precioMinimo)} a ${formatearCOP(precioMaximo as number)}`;

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6">
        <Migas migas={migas} />

        <h1 className="mt-2 font-display text-2xl font-extrabold text-neutro-800 md:text-3xl">
          Pensiones y habitaciones en {nombre}
        </h1>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutro-200 bg-white p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutro-500">
              Publicaciones
            </dt>
            <dd className="mt-1 font-display text-xl font-bold text-neutro-800">
              {pensiones.length}
            </dd>
          </div>

          {minutosMinimos !== null && (
            <div className="rounded-2xl border border-neutro-200 bg-white p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutro-500">
                Más cerca del campus
              </dt>
              <dd className="mt-1 font-display text-xl font-bold text-neutro-800">
                {minutosMinimos} min a pie
              </dd>
            </div>
          )}

          {rangoDePrecio && (
            <div className="rounded-2xl border border-neutro-200 bg-white p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutro-500">
                Habitaciones reservables
              </dt>
              <dd className="mt-1 font-display text-xl font-bold text-neutro-800">
                {rangoDePrecio}
              </dd>
              <p className="mt-1 text-xs text-neutro-500">
                Precio mensual de las habitaciones que hoy se pueden reservar en este barrio.
              </p>
            </div>
          )}
        </dl>

        {servicios.length > 0 && (
          <section className="mt-6" aria-label="Servicios más frecuentes en el barrio">
            <h2 className="font-display text-lg font-bold text-neutro-800">
              Servicios más frecuentes
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {servicios.slice(0, 6).map((servicio) => (
                <li
                  key={servicio.nombre}
                  className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 ring-1 ring-primary-100"
                >
                  {servicio.nombre}
                  <span className="font-normal text-primary-700">
                    {" "}
                    · {servicio.veces} de {pensiones.length}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8" aria-label={`Pensiones publicadas en ${nombre}`}>
          <h2 className="font-display text-lg font-bold text-neutro-800">
            Publicadas en {nombre}
          </h2>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            {pensiones.map((pension) => (
              <CardPension key={pension.id} pension={pension} filtros={FILTROS_INICIALES} />
            ))}
          </div>
        </section>

        <p className="mt-8 text-sm">
          <Link
            href="/#resultados"
            className="font-bold text-primary-700 underline-offset-2 hover:underline"
          >
            Ver todas las pensiones del catálogo
          </Link>
        </p>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdListado) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdMigas(migas)) }}
      />
    </>
  );
}
