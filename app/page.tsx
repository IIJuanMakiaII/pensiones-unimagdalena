import type { Metadata } from "next";
import { catalogoDemo, obtenerPensiones } from "@/lib/datos";
import { DEMO_HABILITADA, SITIO_URL } from "@/lib/sitio";
import { serializarJsonLd } from "@/lib/json-ld";
import Hero from "@/components/Hero";
import SellosConfianza from "@/components/SellosConfianza";
import CatalogoInteractivo from "@/components/CatalogoInteractivo";
import Footer from "@/components/Footer";

/**
 * Landing (Server Component).
 *
 * El hero, los sellos de confianza y el footer se renderizan en el servidor:
 * solo el panel de filtros y la rejilla de resultados son componentes de
 * cliente (components/CatalogoInteractivo.tsx), así que la landing envía mucho
 * menos JavaScript al navegador y mejora LCP/TTI.
 *
 * El catálogo se resuelve en el servidor —Supabase o semilla demo— y se
 * revalida cada 60 s para reflejar publicaciones nuevas sin reconstruir.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const pensiones = await obtenerPensiones();

  // Datos estructurados del listado (SEO): cada pensión como elemento.
  const jsonLdListado = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Pensiones y habitaciones cerca de la Universidad del Magdalena",
    numberOfItems: pensiones.length,
    itemListElement: pensiones.map((pension, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: pension.titulo,
      url: `${SITIO_URL}/pensiones/${pension.id}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdListado) }}
      />
      <Hero />
      <SellosConfianza />
      <CatalogoInteractivo
        pensiones={pensiones}
        pensionesDemo={DEMO_HABILITADA ? catalogoDemo() : []}
        demoHabilitada={DEMO_HABILITADA}
      />
      <Footer />
    </>
  );
}
