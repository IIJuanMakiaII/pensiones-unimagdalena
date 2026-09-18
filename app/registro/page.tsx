import type { Metadata } from "next";
import Link from "next/link";
import FormularioRegistro from "@/components/FormularioRegistro";
import Footer from "@/components/Footer";
import { esSupabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Registro de anfitriones",
  description: "Crea tu cuenta y publica tu pensión o habitación en Santa Marta.",
  robots: { index: false, follow: false },
};

export default function RegistroPage() {
  return (
    <>
      <main className="flex min-h-dvh flex-col items-center justify-center bg-neutro-50 px-4 py-10">
        <Link href="/" className="mb-6 font-display text-lg font-extrabold text-primary-700">
          ← Volver al catálogo
        </Link>
        <FormularioRegistro configurado={esSupabaseConfigurado()} />
      </main>
      <Footer />
    </>
  );
}
