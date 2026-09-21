import type { MetadataRoute } from "next";
import { SITIO_URL } from "@/lib/sitio";

/**
 * Directrices para los buscadores (`/robots.txt`).
 *
 * Se permite el catálogo —es la puerta de entrada de los estudiantes que buscan
 * pensión en Santa Marta— y se excluyen las zonas privadas: publicar, editar,
 * entrar, registrarse y recuperar la contraseña. Sus páginas ya se marcan además
 * con `noindex`, así que esto es la primera barrera, no la única.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/publicar",
          "/publicar/",
          "/login",
          "/registro",
          "/recuperar",
          "/restablecer",
          "/auth/",
          "/offline",
        ],
      },
    ],
    sitemap: `${SITIO_URL}/sitemap.xml`,
    host: SITIO_URL,
  };
}
