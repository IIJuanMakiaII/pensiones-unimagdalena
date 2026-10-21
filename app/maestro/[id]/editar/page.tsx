import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { obtenerPensionPorIdConSesion } from "@/lib/datos";
import { esMaestroConCliente } from "@/lib/maestro";
import { leerContactoDelAnfitrion } from "@/lib/contacto-anfitrion";
import { resolverContactoDePanelDesdeLectura } from "@/lib/contacto-panel";
import { leerReservas, reservasDeLaPension } from "@/lib/reservas";
import { actualizarPensionMaestro } from "@/app/actions/maestro";
import FormularioEditarPension from "@/components/FormularioEditarPension";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Editar anuncio · Panel maestro",
  description: "Edición de una publicación desde el panel del perfil maestro.",
  robots: { index: false, follow: false },
};

/** Panel privado: se renderiza en el servidor en cada visita, con la sesión activa. */
export const dynamic = "force-dynamic";

interface Props {
  /** En Next 15 `params` pasa a ser Promise (misma nota que en la ruta de detalle). */
  params: Promise<{ id: string }>;
}

/**
 * Edición de **cualquier** anuncio desde el panel del maestro (tarea #34).
 *
 * POR QUÉ ESTA RUTA ES UNA COPIA DELGADA Y NO UN PARÁMETRO DE LA DEL ANFITRIÓN
 * ---------------------------------------------------------------------------
 * `app/publicar/[id]/editar` exige `pension.anfitrion_id === user.id` y ese
 * predicado es el hallazgo A-3 de la tarea #16: no se toca. Añadirle «o si es
 * maestro» habría dejado las dos autorizaciones en una sola condición, y a partir
 * de ahí cualquier revisión futura tendría que razonar sobre las dos a la vez.
 *
 * Lo que **no** se duplica es el editor: `FormularioEditarPension` se reutiliza
 * entero, con la acción del maestro y el aviso de retirada que le corresponde. La
 * diferencia entre las dos rutas son las cinco líneas de autorización, no la
 * pantalla.
 *
 * LA LECTURA ES LA CLAVE DE QUE ESTO FUNCIONE
 * ------------------------------------------
 * Se lee con `obtenerPensionPorIdConSesion`, que usa la cookie de la petición. La
 * lectura pública (`obtenerPensionPorId`) va con la clave anónima y solo alcanza
 * las publicaciones con `activa = true`, así que un anuncio retirado no se podría
 * abrir aquí. La RLS decide si esa lectura es legítima: la política «el maestro lee
 * todas» entrega la fila, y cualquier otra sesión recibe cero filas de lo ajeno.
 */
export default async function MaestroEditarPensionPage({ params }: Props) {
  const { id } = await params;

  if (!esSupabaseConfigurado()) notFound();

  let user: { id: string } | null = null;
  let falloSesion = false;

  try {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("No se pudo verificar la sesión para editar como maestro:", error);
    falloSesion = true;
  }

  if (falloSesion) notFound();

  if (!user) redirect(`/login?destino=/maestro/${encodeURIComponent(id)}/editar`);

  if (!(await esMaestroConCliente(await crearClienteServidor()))) notFound();

  const pension = await obtenerPensionPorIdConSesion(id);

  if (!pension) notFound();

  /*
   * El WhatsApp privado **del propietario del anuncio**, para que el maestro pueda
   * escribirle (tarea #79).
   *
   * SE LEE CON `pension.anfitrion_id`, NO CON `user.id`
   * --------------------------------------------------
   * Es el error que más fácil sería cometer aquí: en esta ruta `user` es el maestro,
   * así que `leerContactoDelAnfitrion(user.id)` pediría **su** número —que no tiene,
   * porque quien publica el anuncio es otra persona— y el panel diría «este anfitrión
   * todavía no ha registrado su WhatsApp» sobre un anfitrión que sí lo dejó. La RLS
   * lo autoriza igual: la política de lectura permite la fila al dueño y, por la
   * cláusula `or public.es_maestro()`, también al maestro.
   *
   * AQUÍ SE DISTINGUE «NO HAY» DE «NO SE PUDO COMPROBAR»
   * ---------------------------------------------------
   * Al contrario que el campo del anfitrión —donde da igual, porque puede volver a
   * escribirlo—, aquí el maestro **solo mira**: si la consulta falla y se le dice
   * «no tiene número», concluirá lo contrario de lo cierto y no volverá a mirar. Por
   * eso los cuatro estados llegan intactos a la pantalla, y la tarjeta dice «no
   * pudimos comprobar» cuando corresponde.
   */
  const contactoDelAnfitrion = resolverContactoDePanelDesdeLectura(
    await leerContactoDelAnfitrion(pension.anfitrion_id)
  );

  /*
   * Las reservas vigentes de este anuncio (tarea #119), por la función de la
   * oleada 18. Se piden también en esta ruta porque el editor es el mismo: si aquí
   * faltaran, el maestro vería la casilla «Disponible ahora» activa en una
   * habitación reservada y el guardado fallaría con el mismo `23514`.
   *
   * La función ya resuelve el permiso —el maestro ve todas las reservas— así que
   * aquí no se añade ningún predicado nuevo.
   */
  const { reservas } = await leerReservas();

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <p className="mb-4 text-sm">
          <Link href="/maestro" className="font-bold text-primary-700 hover:underline">
            ← Volver al panel maestro
          </Link>
        </p>

        <FormularioEditarPension
          pension={pension}
          accion={actualizarPensionMaestro}
          volverA="/maestro"
          avisoRetirada={
            <>
              Este anuncio está <strong>retirado</strong>: no aparece en el catálogo y su ficha
              responde 404 al público. Puedes corregirlo igualmente y volver a publicarlo desde el
              panel maestro.
            </>
          }
          contactoDelAnfitrion={contactoDelAnfitrion}
          reservas={reservasDeLaPension(
            reservas,
            pension.habitaciones.map((habitacion) => habitacion.id)
          )}
        />
      </main>
      <Footer />
    </>
  );
}
