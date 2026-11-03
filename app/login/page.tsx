import type { Metadata } from "next";
import Link from "next/link";
import FormularioLogin from "@/components/FormularioLogin";
import Footer from "@/components/Footer";
import { destinoInterno } from "@/lib/destino-seguro";
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
  // Misma regla que `/auth/confirmar` (SEC-03): se resuelve el destino y se
  // compara el origen. El filtro anterior —una expresión regular que exigía
  // barra inicial y descartaba la doble barra— bloqueaba `//evil.com` pero no
  // `/\evil.com`, que el navegador lee como dominio externo. Aquí el
  // valor termina en `router.push`, que no sale del origen, así que era un fallo
  // latente; se corrige igual para que solo haya una regla.
  // El origen es ficticio a propósito: solo sirve de base para resolver rutas.
  const destino = destinoInterno(destinoSolicitado, "https://nido.invalid");

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
