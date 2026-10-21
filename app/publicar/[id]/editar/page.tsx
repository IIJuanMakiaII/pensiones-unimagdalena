import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { obtenerPensionPorIdConSesion } from "@/lib/datos";
import { leerContactoDelAnfitrion } from "@/lib/contacto-anfitrion";
import { leerReservas, reservasDeLaPension } from "@/lib/reservas";
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
 * o inventado responde 404 sin revelar si existe: la RLS de `pensiones` no
 * entrega a esta sesión nada que no sea suyo, y aquí se exige además que el
 * dueño sea quien está editando.
 *
 * LA LECTURA TIENE QUE LLEVAR LA SESIÓN (tarea #34)
 * ------------------------------------------------
 * Aquí se leía con `obtenerPensionPorId`, que resuelve con la clave anónima y por
 * tanto solo alcanza las publicaciones con `activa = true`. El resultado era un
 * defecto real: **este botón daba 404 en un anuncio retirado**, incluso para su
 * propio dueño, aunque el panel lo ofrecía a propósito
 * (`components/PanelPublicacion.tsx`: «una publicación retirada también necesita
 * corregirse antes de volver a publicarla»). Y el middleware ya declaraba esa
 * misma intención al dejar pasar la ficha retirada a quien tiene sesión.
 *
 * Se usa `obtenerPensionPorIdConSesion`, que lee con la cookie de la petición. El
 * control de acceso no se relaja: no hay ningún `anfitrion_id` menos, sigue el de
 * la línea siguiente, y la RLS decide qué filas llegan a esta sesión. Un anuncio
 * ajeno sigue respondiendo 404 —lo confirma la prueba de la suite del maestro— y
 * lo único que cambia es que el dueño ya puede abrir el suyo cuando está retirado.
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

  const pension = await obtenerPensionPorIdConSesion(id);

  if (!pension || pension.anfitrion_id !== user.id) notFound();

  /*
   * El número privado del anfitrión, para que este pueda ver lo que ya dejó (tarea
   * #77). Se lee con la sesión de la petición, y la RLS de `contacto_anfitrion`
   * solo entrega la fila propia: aquí solo se llega siendo el dueño del anuncio.
   *
   * SÍ APARECE EN EL HTML DE ESTA PÁGINA, Y ES LO CORRECTO
   * -----------------------------------------------------
   * Lo que la petición prohíbe es que el número viaje al **público**: la portada,
   * la ficha, su JSON, sus datos estructurados y el mapa del sitio. Esta pantalla
   * no es nada de eso: exige sesión, responde 404 a quien no sea el dueño, está
   * marcada `noindex` y se renderiza en cada visita (`force-dynamic`), así que no
   * se guarda en ninguna caché. Sin verlo, el anfitrión no tendría forma de saber
   * qué número tiene registrado ni de corregirlo.
   *
   * Los estados que no son «ok» —`sin-tabla` (migración sin aplicar), `sin-numero`
   * y `error`— dejan el campo vacío y el pie del campo ya explica qué hacer. Aquí
   * no se distingue «no hay» de «no se pudo comprobar» a propósito: en este
   * formulario, el efecto es el mismo y el anfitrión puede volver a escribirlo.
   */
  const contacto = await leerContactoDelAnfitrion(user.id);

  /*
   * Las reservas vigentes de este anuncio (tarea #119), para que el editor no
   * ofrezca «Disponible ahora» en una habitación reservada: la base lo rechaza con
   * `23514` y hasta hoy el aviso hablaba de otra cosa.
   *
   * Se leen por la función, nunca por `SELECT` de `reservada_en` — esa columna no
   * es legible por `authenticated` y pedirla dejaría la lectura entera en `42501`.
   * Si la lectura falla, el mapa llega vacío y el editor se comporta como antes de
   * la oleada 17: no se inventa ninguna reserva ni se bloquea nada de más.
   */
  const { reservas } = await leerReservas();

  return (
    <>
      <main id="resultados" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <p className="mb-4 text-sm">
          <Link href="/publicar" className="font-bold text-primary-700 hover:underline">
            ← Volver a mi panel
          </Link>
        </p>

        <FormularioEditarPension
          pension={pension}
          mostrarWhatsapp
          whatsappActual={contacto.estado === "ok" ? contacto.whatsapp : null}
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
