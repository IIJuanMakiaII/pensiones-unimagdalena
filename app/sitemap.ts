import type { MetadataRoute } from "next";
import { SITIO_URL } from "@/lib/sitio";
import { obtenerPensionesReales } from "@/lib/datos";

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
    url: `${SITIO_URL}/pensiones/${pension.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [portada, ...fichas];
}
