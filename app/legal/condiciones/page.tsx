import type { Metadata } from "next";
import Link from "next/link";
import DocumentoLegal from "@/components/DocumentoLegal";
import Footer from "@/components/Footer";
import { SITIO_URL } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Condiciones de uso",
  description:
    "Cómo funciona Nido: llevamos el contacto con los anfitriones y cerramos contigo la reserva del primer mes.",
  alternates: { canonical: `${SITIO_URL}/legal/condiciones` },
  /**
   * Sin indexar hasta que se decida lo contrario (ver el comentario largo en
   * /legal/privacidad). No es por datos sin rellenar: el cartel que avisaba de ello
   * se retiró en la tarea #125 y el documento está completo.
   */
  robots: { index: false, follow: true },
};

export default function CondicionesPage() {
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

        <DocumentoLegal archivo="condiciones-de-uso.md" />
      </main>
      <Footer />
    </>
  );
}
