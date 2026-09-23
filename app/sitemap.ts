import type { MetadataRoute } from "next";
import { SITIO_URL } from "@/lib/sitio";
import { obtenerPensionesReales } from "@/lib/datos";
import { resumenesDeBarrio } from "@/lib/barrios";

/** Páginas de contenido que existen siempre y no dependen del catálogo. */
const GUIAS = ["/guias/como-elegir-pension-unimagdalena"];

/**
 * Mapa del sitio (`/sitemap.xml`).
 *
 * Regla de oro: **solo URLs que existen de verdad**. Nada de rutas privadas
 * (van en `robots.txt`) y nada de la semilla de demostración: lo que entra aquí
 * se indexa, y al apagar la demo quedarían fichas fantasma. Por eso la fuente es
 * `obtenerPensionesReales()`, que devuelve lista vacía si la base no responde.
 *
 * Se regenera cada hora: el catálogo cambia con las publicaciones, no cada
 * segundo, y así la respuesta se sirve desde caché en lugar de consultar la base
 * en cada petición de un robot.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pensiones = await obtenerPensionesReales();

  const portada: MetadataRoute.Sitemap[number] = {
    url: `${SITIO_URL}/`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  };

  const fichas: MetadataRoute.Sitemap = pensiones.map((pension) => ({
    // Dirección legible: es la que se comparte y la que resolverá el middleware.
    url: `${SITIO_URL}/pensiones/${pension.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  /**
   * Los barrios salen de las **mismas** publicaciones reales, así que heredan la
   * garantía: mientras no haya publicaciones reales, no se anuncia ningún barrio.
   * El índice de barrios solo se anuncia cuando existe de verdad, porque con cero
   * barrios esa ruta responde 404 y anunciarla sería prometer una página vacía.
   */
  const barrios = resumenesDeBarrio(pensiones);

  const indiceBarrios: MetadataRoute.Sitemap =
    barrios.length > 0
      ? [
          {
            url: `${SITIO_URL}/barrios`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
          },
        ]
      : [];

  const paginasDeBarrio: MetadataRoute.Sitemap = barrios.map((barrio) => ({
    url: `${SITIO_URL}/barrios/${barrio.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const guias: MetadataRoute.Sitemap = GUIAS.map((ruta) => ({
    url: `${SITIO_URL}${ruta}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [portada, ...indiceBarrios, ...paginasDeBarrio, ...fichas, ...guias];
}
