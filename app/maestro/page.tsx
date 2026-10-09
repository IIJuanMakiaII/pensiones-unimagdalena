import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { obtenerTodasLasPensiones } from "@/lib/datos";
import { esMaestroConCliente } from "@/lib/maestro";
import PanelMaestro from "@/components/PanelMaestro";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Panel maestro",
  description: "Administración de todas las pensiones publicadas en Nido.",
  robots: { index: false, follow: false },
};

/**
 * Panel privado: se renderiza en el servidor en cada visita, con la sesión activa.
 *
 * `force-dynamic` no es cosmético aquí. La lista muestra anuncios retirados, que no
 * pueden quedar en una caché compartida ni prerenderizada; y además hace que
 * `pruebas/invalidacion.prueba.ts` exima a esta ruta de la lista
 * `RUTAS_DEL_CATALOGO`, que es exactamente lo que se quiere: no es una página de
 * catálogo, es un panel.
 */
export const dynamic = "force-dynamic";

interface Props {
  /** En Next 15 `searchParams` pasa a ser Promise (misma nota que en `/publicar`). */
  searchParams: Promise<{ editada?: string; borrada?: string }>;
}

/**
 * Panel del perfil maestro (tarea #34).
 *
 * TRES PUERTAS, Y LA TERCERA ES LA QUE CUENTA
 * ------------------------------------------
 *  1. Sin Supabase configurado no hay nada que mostrar.
 *  2. Sin sesión se va al login. El middleware ya cubre `/maestro`, pero eso es
 *     comodidad de navegación, no autorización: `redirect` aquí es la segunda capa.
 *  3. **`es_maestro()` contra la base.** Es la única que autoriza. Si devuelve
 *     falso —o si no se pudo comprobar, porque `esMaestroConCliente` falla
 *     cerrado—, la respuesta es `notFound()`.
 *
 * POR QUÉ `notFound()` Y NO UN AVISO
 * ----------------------------------
 * Un 404 no distingue «no existe» de «no es para ti», así que un anfitrión que
 * escriba la dirección a mano no aprende nada del panel: ni que existe, ni qué
 * muestra, ni que hay un rol por encima del suyo. Un aviso del tipo «no tienes
 * permiso» confirmaría las tres cosas. El criterio de aceptación admite las dos
 * respuestas; esta es la que no filtra información.
 *
 * El rol **no** se lee de `user_metadata`: esos metadatos los escribe el propio
 * usuario, así que leerlos aquí sería un agujero de escalada. La pregunta se le
 * hace a la base, que es quien sabe.
 */
export default async function MaestroPage({ searchParams }: Props) {
  const { editada, borrada } = await searchParams;

  if (!esSupabaseConfigurado()) notFound();

  let user: { id: string; email?: string } | null = null;
  let falloSesion = false;

  try {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("No se pudo verificar la sesión del panel maestro:", error);
    falloSesion = true;
  }

  // Si el servicio de cuentas no responde, no se inventa ni un permiso ni una lista.
  if (falloSesion) notFound();

  if (!user) redirect("/login?destino=/maestro");

  const esMaestro = await esMaestroConCliente(await crearClienteServidor());

  if (!esMaestro) notFound();

  const pensiones = await obtenerTodasLasPensiones();
  const activas = pensiones.filter((pension) => pension.activa).length;
  const retiradas = pensiones.length - activas;

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-neutro-900">Panel maestro</h1>
          <p className="mt-1 text-sm text-neutro-600">{user.email}</p>
          <p className="mt-2 text-sm text-neutro-600">
            {pensiones.length} anuncio{pensiones.length === 1 ? "" : "s"} en total ·{" "}
            {activas} publicada{activas === 1 ? "" : "s"} · {retiradas} retirada
            {retiradas === 1 ? "" : "s"}
          </p>
        </div>

        {editada === "1" && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800"
          >
            ✓ Cambios guardados. El catálogo y la ficha ya los muestran.
          </p>
        )}

        {/* El aviso del borrado vive aquí, y no en la tarjeta que lo pidió, porque
            esa tarjeta desaparece al recargar la lista. Aquí sobrevive, y es el
            único sitio donde se puede contar la parte que duele: qué murió y qué
            no. La dirección viaja en el parámetro porque el anuncio ya no existe
            para poder consultarla. */}
        {borrada && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-confianza-danger/30 bg-confianza-danger/10 px-4 py-3 text-sm text-neutro-800"
          >
            <p className="font-bold">Anuncio borrado definitivamente.</p>
            <p className="mt-1 leading-relaxed">
              Su dirección{" "}
              <strong className="break-all">/pensiones/{borrada}</strong> queda muerta para siempre:
              el sistema reserva las direcciones de lo que se borra y no las vuelve a usar.
            </p>
            <p className="mt-1 leading-relaxed">
              Las <strong>fotos no se borraron</strong>: siguen en el almacenamiento, sin nada que
              las use.
            </p>
          </div>
        )}

        <section className="mt-8" aria-label="Todas las publicaciones">
          <h2 className="font-display text-lg font-bold text-neutro-800">Todas las pensiones</h2>

          {pensiones.length === 0 ? (
            <p className="mt-2 text-sm text-neutro-600">
              No hay ninguna pensión publicada todavía.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {pensiones.map((pension) => (
                <PanelMaestro key={pension.id} pension={pension} />
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-sm">
          <Link href="/" className="font-bold text-primary-700 hover:underline">
            ← Volver al catálogo
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
