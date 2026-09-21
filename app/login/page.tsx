import type { Metadata } from "next";
import Link from "next/link";
import FormularioLogin from "@/components/FormularioLogin";
import Footer from "@/components/Footer";
import { esSupabaseConfigurado } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Acceso anfitriones",
  description: "Inicia sesión para publicar y administrar tus pensiones.",
  robots: { index: false, follow: false },
};

interface Props {
  /** En Next 15 `searchParams` también pasa a ser Promise (ver nota en la ruta de detalle). */
  searchParams: Promise<{ destino?: string; aviso?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { destino: destinoSolicitado, aviso } = await searchParams;
  // Solo rutas internas: `startsWith("/")` dejaba pasar `//evil.com`, que el
  // navegador interpreta como dominio externo (redirección abierta).
  const destino =
    destinoSolicitado && /^\/(?!\/)/.test(destinoSolicitado) ? destinoSolicitado : "/publicar";

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
        <FormularioLogin destino={destino} configurado={esSupabaseConfigurado()} aviso={aviso} />
      </main>
      <Footer />
    </>
  );
}
