import type { Metadata } from "next";
import Link from "next/link";
import FormularioRecuperar from "@/components/FormularioRecuperar";
import Footer from "@/components/Footer";
import { esSupabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Recupera el acceso a tu cuenta de anfitrión por correo electrónico.",
  robots: { index: false, follow: false },
};

/** Paso 1 de la recuperación: pedir el enlace por correo. */
export default function RecuperarPage() {
  return (
    <>
      <main
        id="resultados"
        tabIndex={-1}
        className="flex min-h-dvh flex-col items-center justify-center bg-neutro-50 px-4 py-10"
      >
        <Link href="/" className="mb-6 font-display text-lg font-extrabold text-primary-700">
          ← Volver al catálogo
        </Link>
        <FormularioRecuperar configurado={esSupabaseConfigurado()} />
      </main>
      <Footer />
    </>
  );
}
