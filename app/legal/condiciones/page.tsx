import type { Metadata } from "next";
import Link from "next/link";
import DocumentoLegal from "@/components/DocumentoLegal";
import Footer from "@/components/Footer";
import { SITIO_URL } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Condiciones de uso",
  description:
    "Cómo funciona Pensiones Unimagdalena: es una vitrina de contacto directo, el arriendo y el pago ocurren fuera de la plataforma.",
  alternates: { canonical: `${SITIO_URL}/legal/condiciones` },
  /** Sin indexar mientras esté en revisión jurídica (ver /legal/privacidad). */
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

        <p
          role="note"
          className="mb-5 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-4 py-3 text-sm font-semibold text-neutro-700"
        >
          Este texto está pendiente de revisión jurídica y sus datos del responsable figuran como
          PENDIENTE. No lo tomes todavía como las condiciones definitivas.
        </p>

        <DocumentoLegal archivo="condiciones-de-uso.md" />
      </main>
      <Footer />
    </>
  );
}
