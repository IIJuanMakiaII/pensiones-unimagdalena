import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerPensionesReales } from "@/lib/datos";
import { resumenesDeBarrio } from "@/lib/barrios";
import { formatearCOP } from "@/lib/formato";
import { SITIO_URL } from "@/lib/sitio";
import { MIGA_INICIO } from "@/lib/migas";
import Migas from "@/components/Migas";
import Footer from "@/components/Footer";

/**
 * Indice de barrios.
 *
 * Es el escalon intermedio entre la portada y cada barrio: da una jerarquia real
 * al enlazado interno (en lugar de enlazar los barrios solo desde el pie) y evita
 * que la miga de pan tenga que saltarse un nivel inventado.
 *
 * Se alimenta **solo** de publicaciones reales. Si no hay ninguna, la pagina no
 * existe: un indice vacio no ayuda a nadie y seria justo el tipo de pagina hueca
 * que este proyecto decidio no publicar.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Barrios cerca de la Universidad del Magdalena",
  description:
    "Barrios de Santa Marta con pensiones y habitaciones para estudiantes cerca de la Universidad del Magdalena, con precios y distancia a pie.",
  alternates: { canonical: `${SITIO_URL}/barrios` },
};

export default async function PaginaBarrios() {
  const resumenes = resumenesDeBarrio(await obtenerPensionesReales());
  if (resumenes.length === 0) notFound();

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-6">
        <Migas migas={[MIGA_INICIO, { nombre: "Barrios", ruta: "/barrios" }]} />

        <h1 className="mt-2 font-display text-2xl font-extrabold text-neutro-800 md:text-3xl">
          Barrios cerca de la Universidad del Magdalena
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutro-600">
          Los barrios donde hoy hay habitaciones publicadas. La distancia es la que declara cada
          anfitrión y el rango de precios sale de las habitaciones que se pueden reservar.
        </p>

        <ul className="mt-6 space-y-3">
          {resumenes.map((resumen) => (
            <li key={resumen.slug}>
              <Link
                href={`/barrios/${resumen.slug}`}
                className="block rounded-2xl border border-neutro-200 bg-white p-4 transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <span className="font-display text-lg font-bold text-neutro-800">
                  {resumen.barrio}
                </span>
                <span className="mt-1 block text-sm text-neutro-600">
                  {resumen.pensiones.length === 1
                    ? "1 pensión publicada"
                    : `${resumen.pensiones.length} pensiones publicadas`}
                  {resumen.minutosMinimos !== null && ` · desde ${resumen.minutosMinimos} min a pie`}
                  {resumen.precioMinimo !== null &&
                    ` · desde ${formatearCOP(resumen.precioMinimo)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm">
          <Link
            href="/#resultados"
            className="font-bold text-primary-700 underline-offset-2 hover:underline"
          >
            Ver el catálogo completo
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
