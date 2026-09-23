import { SITIO_URL } from "@/lib/sitio";

/**
 * Ruta de navegacion (migas de pan).
 *
 * La ruta se guarda **relativa** y solo se convierte en absoluta al construir los
 * datos estructurados, que es el unico sitio donde se exige una URL completa. Si
 * se guardara absoluta, el componente tendria que volver a recortarla para pintar
 * los enlaces.
 */
export interface Miga {
  nombre: string;
  /** Ruta relativa al sitio, empezando por `/`. */
  ruta: string;
}

/** Datos estructurados `BreadcrumbList` correspondientes a la ruta dada. */
export function jsonLdMigas(migas: Miga[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((miga, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: miga.nombre,
      item: `${SITIO_URL}${miga.ruta}`,
    })),
  };
}

/** Escalon de inicio, comun a todas las rutas del sitio. */
export const MIGA_INICIO: Miga = { nombre: "Inicio", ruta: "/" };
