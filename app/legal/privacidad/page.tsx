import type { Metadata } from "next";
import Link from "next/link";
import DocumentoLegal from "@/components/DocumentoLegal";
import Footer from "@/components/Footer";
import { SITIO_URL } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description:
    "Qué datos guarda Pensiones Unimagdalena, de quién son, dónde quedan y qué es visible sin haber iniciado sesión.",
  alternates: { canonical: `${SITIO_URL}/legal/privacidad` },
  /**
   * Sin indexar mientras el documento esté en revisión jurídica: contiene los
   * datos del responsable marcados como PENDIENTE. Cuando el abogado lo valide y
   * estén rellenos, se quita esta línea y pasa a indexarse como cualquier página.
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

        <p
          role="note"
          className="mb-5 rounded-xl border border-confianza-gold/40 bg-confianza-gold/10 px-4 py-3 text-sm font-semibold text-neutro-700"
        >
          Este texto está pendiente de revisión jurídica y sus datos del responsable figuran como
          PENDIENTE. No lo tomes todavía como el aviso definitivo.
        </p>

        <DocumentoLegal archivo="aviso-de-privacidad.md" />
      </main>
      <Footer />
    </>
  );
}
