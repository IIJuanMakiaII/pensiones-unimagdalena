import type { Metadata } from "next";
import { catalogoDemo, obtenerCatalogo } from "@/lib/datos";
import { esFalloDeLectura } from "@/lib/catalogo-respaldo";
import { DEMO_HABILITADA, SITIO_URL } from "@/lib/sitio";
import { serializarJsonLd } from "@/lib/json-ld";
import { mostrarListaDeEspera } from "@/lib/lista-espera";
import Hero from "@/components/Hero";
import ComoFunciona from "@/components/ComoFunciona";
import CatalogoInteractivo from "@/components/CatalogoInteractivo";
import ListaDeEspera from "@/components/ListaDeEspera";
import ErrorCatalogo from "@/components/ErrorCatalogo";
import Footer from "@/components/Footer";

/**
 * Landing (Server Component).
 *
 * El hero, la sección de confianza y el footer se renderizan en el servidor:
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
  /**
   * El catálogo llega **con su motivo** (tarea #67), y con él la portada puede separar
   * tres situaciones que antes se veían iguales: hay inventario, no hay inventario
   * —un estado legítimo del negocio— y la lectura de la base falló —una avería—. Sin
   * el motivo, las dos últimas llegan aquí como «cero anuncios» y la página no tiene
   * con qué distinguirlas.
   */
  const catalogo = await obtenerCatalogo();
  const { pensiones } = catalogo;

  /**
   * La avería se resuelve **antes** que el vacío, y no al revés (tarea #68): si la base
   * no respondió, no se puede afirmar que no haya nada publicado, así que el estado sin
   * inventario no entra en juego. Por eso la lista de espera queda condicionada a que
   * no haya fallo, y el hero también: con `sinInventario` prometía «te aviso cuando
   * haya habitaciones» a quien en realidad estaba viendo una avería.
   *
   * Las dos decisiones siguen viviendo fuera del JSX —`esFalloDeLectura()` en
   * `lib/catalogo-respaldo.ts` y `mostrarListaDeEspera()` en `lib/lista-espera.ts`—
   * para poder comprobarse sin navegador.
   */
  const falloDeLectura = esFalloDeLectura(catalogo);
  const listaDeEspera = !falloDeLectura && mostrarListaDeEspera(pensiones.length, DEMO_HABILITADA);

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
      url: `${SITIO_URL}/pensiones/${pension.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLdListado) }}
      />
      <Hero sinInventario={listaDeEspera} />
      <ComoFunciona />
      {falloDeLectura ? (
        <ErrorCatalogo />
      ) : listaDeEspera ? (
        <ListaDeEspera />
      ) : (
        /* El encabezado de esta sección —el H2 sin texto visible, que es lo que impide
           que los títulos de las tarjetas cuelguen del H1 sin nivel intermedio— **no**
           se escribe aquí: lo aporta `CatalogoInteractivo`, ya dentro de
           `<main id="resultados">`. La página lo dibujaba además por su cuenta y el
           resultado eran dos encabezados idénticos seguidos, que un lector de pantalla
           anuncia dos veces. El del catálogo es el que se queda, porque es el que cae
           dentro del landmark y del destino del salto al contenido. */
        <CatalogoInteractivo
          pensiones={pensiones}
          pensionesDemo={DEMO_HABILITADA ? catalogoDemo() : []}
          demoHabilitada={DEMO_HABILITADA}
        />
      )}
      <Footer />
    </>
  );
}
