import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/utils/supabase/server";
import { esSupabaseConfigurado } from "@/lib/supabase/config";
import { obtenerTodasLasPensiones } from "@/lib/datos";
import { MAXIMO_DE_CONSULTA, filtrarPensiones, prepararConsulta } from "@/lib/busqueda-panel";
import { esMaestroConCliente } from "@/lib/maestro";
import { leerContactosDeAnfitriones } from "@/lib/contacto-anfitrion";
import { resolverContactoDePanel } from "@/lib/contacto-panel";
import { leerReservas, reservasDeLaPension } from "@/lib/reservas";
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
  searchParams: Promise<{ editada?: string; borrada?: string; buscar?: string }>;
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
  const { editada, borrada, buscar } = await searchParams;

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

  /*
   * El buscador (tarea #88). La consulta llega en la dirección (`?buscar=`) y el
   * filtro se aplica **en memoria**, sobre la lista que se acaba de leer: no hay
   * una segunda consulta, ni SQL nuevo, ni cambio de permisos. Buscar es una
   * navegación normal, así que funciona sin JavaScript y sobrevive a recargar y al
   * enlace compartido.
   *
   * El recuento del filtro es lo que informa de si se encontró algo; no se toca el
   * total de arriba, que sigue contando el catálogo entero.
   *
   * `typeof` no es paranoia: `?buscar=a&buscar=b` llega como arreglo, y a esta
   * pantalla se entra escribiendo la dirección a mano. Sin esta línea, una consulta
   * repetida rompería el panel con un error en lugar de ignorarse.
   */
  const consulta = prepararConsulta(typeof buscar === "string" ? buscar : "");
  const hayConsulta = consulta !== "";
  const coincidencias = filtrarPensiones(pensiones, consulta);
  const resumenDeLaBusqueda = `${coincidencias.length} ${
    coincidencias.length === 1 ? "anuncio coincide" : "anuncios coinciden"
  } con «${consulta}»`;

  /*
   * El WhatsApp privado de cada anunciante (tarea #77), en **una** consulta para
   * toda la lista: con veinte anuncios, una consulta por tarjeta serían veinte
   * viajes a la base para pintar un botón. El lector deduplica los identificadores
   * por su cuenta, así que veinte anuncios de cinco anfitriones viajan como cinco.
   *
   * Y NO PUEDE TUMBAR EL PANEL: los anuncios ya están leídos y pintados arriba. Si
   * la tabla todavía no existe —la migración la aplica el propietario a mano—, el
   * lector devuelve `sin-tabla` y aquí simplemente no se dibuja el botón. Un 404 de
   * PostgREST no se convierte en un error de la página, que es lo que permitiría
   * desplegar en cualquier orden.
   */
  const { contactos, motivo } = await leerContactosDeAnfitriones(
    pensiones.map((pension) => pension.anfitrion_id)
  );

  /*
   * Las reservas vigentes con su fecha (tarea #119), por la función de la base
   * `listar_reservas` —`security definer`, oleada 18—. La columna `reservada_en`
   * no tiene `SELECT` para ningún rol de cliente: pedirla aquí daría `42501` y se
   * llevaría por delante el panel entero.
   *
   * Es una sola llamada para todo el panel, igual que los contactos: con veinte
   * anuncios, una por tarjeta serían veinte viajes para pintar una línea de texto.
   * Y no puede tumbar la página: si la lectura falla, `leerReservas` devuelve el
   * mapa vacío y las tarjetas se dibujan como antes de esta tarea, sin fecha.
   */
  const { reservas } = await leerReservas();

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

        {/* La sección se rotula con su propio encabezado, y ese encabezado lleva el
            recuento cuando hay consulta. Es la forma de que quien entra leyendo sepa
            cuántos coinciden sin depender de un anuncio en vivo: la búsqueda es una
            navegación completa, así que un `role="status"` que se reemplaza al
            recargar no llegaría a oírse. */}
        <section className="mt-8" aria-labelledby="titulo-publicaciones">
          <h2 id="titulo-publicaciones" className="font-display text-lg font-bold text-neutro-800">
            {hayConsulta ? resumenDeLaBusqueda : "Todas las pensiones"}
          </h2>

          {pensiones.length === 0 ? (
            <p className="mt-2 text-sm text-neutro-600">
              No hay ninguna pensión publicada todavía.
            </p>
          ) : (
            <>
              {/* Formulario GET: sin estado de cliente y sin `fetch`. El campo se
                  dibuja siempre que haya algo que buscar, para que no aparezca y
                  desaparezca según el recuento. */}
              <form method="get" action="/maestro" className="mt-4">
                <label htmlFor="buscar" className="block text-sm font-semibold text-neutro-700">
                  Buscar pensión
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="buscar"
                    name="buscar"
                    type="search"
                    defaultValue={consulta}
                    maxLength={MAXIMO_DE_CONSULTA}
                    placeholder="NID-0001, nombre o barrio"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="h-12 w-full rounded-xl border border-neutro-300 bg-white px-3 text-base text-neutro-900 outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-600/30"
                  />
                  <button
                    type="submit"
                    className="h-12 shrink-0 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white transition hover:bg-primary-700"
                  >
                    Buscar
                  </button>
                </div>
                {hayConsulta && (
                  <Link
                    href="/maestro"
                    className="mt-2 inline-block text-sm font-semibold text-primary-700 hover:underline"
                  >
                    Quitar la búsqueda
                  </Link>
                )}
              </form>

              {coincidencias.length === 0 ? (
                /* El mensaje del catálogo vacío no sirve aquí: afirmaría que no hay
                   ninguna pensión publicada cuando lo que pasa es que la consulta no
                   encontró nada. Son dos estados distintos (tarea #67). */
                <div
                  role="status"
                  className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-neutro-700 ring-1 ring-neutro-200"
                >
                  <p className="font-semibold">Ninguna pensión coincide con «{consulta}».</p>
                  <p className="mt-1">
                    <Link href="/maestro" className="font-bold text-primary-700 hover:underline">
                      Ver los {pensiones.length} anuncios
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {coincidencias.map((pension) => (
                    <PanelMaestro
                      key={pension.id}
                      pension={pension}
                      contacto={resolverContactoDePanel(
                        contactos.get(pension.anfitrion_id) ?? null,
                        motivo
                      )}
                      reservas={reservasDeLaPension(
                        reservas,
                        pension.habitaciones.map((habitacion) => habitacion.id)
                      )}
                    />
                  ))}
                </div>
              )}
            </>
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
