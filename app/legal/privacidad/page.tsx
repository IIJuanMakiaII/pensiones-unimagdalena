import type { Metadata } from "next";
import Link from "next/link";
import DocumentoLegal from "@/components/DocumentoLegal";
import Footer from "@/components/Footer";
import { SITIO_URL } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description:
    "Qué datos guarda Nido, de quién son, dónde quedan y qué es visible sin haber iniciado sesión.",
  alternates: { canonical: `${SITIO_URL}/legal/privacidad` },
  /**
   * Sin indexar mientras el documento no haya pasado por revisión jurídica.
   *
   * El motivo ya no es el que decía antes: los datos del responsable **están
   * rellenos** y el cartel que avisaba de que el texto seguía en revisión se
   * retiró de la página (tarea #125). Lo que queda es la decisión, que no es del
   * código:
   * meter un contrato en el índice de Google antes de que lo lea un abogado
   * expone el texto a cualquiera que lo busque. Se deja fuera hasta que se decida
   * lo contrario, y entonces basta con quitar esta línea.
   */
  robots: { index: false, follow: true },
};

export default function PrivacidadPage() {
  return (
    <>
      <main
        id="resultados"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10"
      >
        <p className="mb-4">
          <Link href="/" className="text-sm font-bold text-primary-700 hover:underline">
            ← Volver al catálogo
          </Link>
        </p>

        <DocumentoLegal archivo="aviso-de-privacidad.md" />
      </main>
      <Footer />
    </>
  );
}
