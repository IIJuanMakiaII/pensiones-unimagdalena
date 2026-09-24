import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { obtenerPensionPorId } from "@/lib/datos";
import FormularioEditarPension from "@/components/FormularioEditarPension";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Editar mi pensión",
  description: "Editor de una publicación del panel de anfitriones.",
  robots: { index: false, follow: false },
};

/** Panel privado: se renderiza en el servidor en cada visita, con la sesión activa. */
export const dynamic = "force-dynamic";

interface Props {
  /** En Next 15 `params` pasa a ser Promise (misma nota que en la ruta de detalle). */
  params: Promise<{ id: string }>;
}

/**
 * Edición de un anuncio publicado.
 *
 * Doble protección antes de renderizar: sin sesión se va al login (el middleware
 * ya cubre `/publicar/*`), y con sesión solo se edita **lo propio**. Un id ajeno
 * o inventado responde 404 sin revelar si existe: la RLS de `pensiones` solo
 * entrega las activas al público y las retiradas a su dueño, y aquí se exige
 * además que el dueño sea quien está editando.
 */
export default async function EditarPensionPage({ params }: Props) {
  const { id } = await params;

  if (!esSupabaseConfigurado()) redirect("/publicar");

  let user: { id: string } | null = null;
  let falloSesion = false;

  try {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("No se pudo verificar la sesión para editar:", error);
    falloSesion = true;
  }

  // Si el servicio de cuentas no responde, el panel muestra el aviso de sesión
  // en lugar de un error sin contexto.
  if (falloSesion) redirect("/publicar");

  if (!user) redirect(`/login?destino=/publicar/${encodeURIComponent(id)}/editar`);

  const pension = await obtenerPensionPorId(id);

  if (!pension || pension.anfitrion_id !== user.id) notFound();

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <p className="mb-4 text-sm">
          <Link href="/publicar" className="font-bold text-primary-700 hover:underline">
            ← Volver a mi panel
          </Link>
        </p>

        <FormularioEditarPension pension={pension} />
      </main>
      <Footer />
    </>
  );
}
