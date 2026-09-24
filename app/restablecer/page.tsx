import type { Metadata } from "next";
import Link from "next/link";
import FormularioRestablecer from "@/components/FormularioRestablecer";
import Footer from "@/components/Footer";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { crearClienteServidor } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  description: "Crea una contraseña nueva para tu cuenta de anfitrión.",
  robots: { index: false, follow: false },
};

/** Depende de la sesión: el enlace del correo la deja iniciada al canjearse. */
export const dynamic = "force-dynamic";

/** Paso 2 de la recuperación: fijar la contraseña nueva. */
export default async function RestablecerPage() {
  let conSesion = false;

  if (esSupabaseConfigurado()) {
    try {
      const supabase = await crearClienteServidor();
      const { data } = await supabase.auth.getUser();
      conSesion = Boolean(data.user);
    } catch (error) {
      // Si Supabase no responde se muestra el aviso de enlace no válido, que
      // ofrece pedir otro, en lugar de un error técnico sin salida.
      console.error("No se pudo comprobar la sesión en /restablecer:", error);
    }
  }

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
        <FormularioRestablecer conSesion={conSesion} />
      </main>
      <Footer />
    </>
  );
}
