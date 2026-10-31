import type { Metadata } from "next";
import Link from "next/link";
import DocumentoLegal from "@/components/DocumentoLegal";
import EnlacesLegales from "@/components/EnlacesLegales";
import Footer from "@/components/Footer";
import { SITIO_URL } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Política de reembolsos",
  description:
    "Qué es el depósito de reserva del 20 %, qué recuperas si cancelas antes del ingreso y cómo se pide la devolución.",
  alternates: { canonical: `${SITIO_URL}/legal/reembolsos` },
  /**
   * Sin indexar, igual que las otras dos páginas legales (ver el comentario largo
   * en `/legal/privacidad`). Se enlaza desde el pie, desde la ficha y entre los
   * tres documentos; no necesita aparecer en buscadores para cumplir su función.
   */
  robots: { index: false, follow: true },
};

export default function ReembolsosPage() {
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

        <EnlacesLegales actual="/legal/reembolsos" />

        <DocumentoLegal archivo="politica-de-reembolsos.md" />
      </main>
      <Footer />
    </>
  );
}
